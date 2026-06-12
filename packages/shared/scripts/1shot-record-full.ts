/**
 * Record the FULL mainnet chain for the OneShotFinale replay — every track in ONE flow:
 *
 *   A2A   user SA ──root(standing: this board · ≤3 votes · 7d)──▶ orchestrator
 *                 ──mid(attenuated: +limitedCalls 1)───────────▶ analyst
 *                 ──leaf(locked: EXACTLY castVote(proposalId, decidedSupport))─▶ 1Shot target
 *   x402  the user's USDC budget pays the analyst's data toll (0.001 USDC, on-chain redeem)
 *   TEE   the Venice committee (4 lenses + arbiter) DECIDES the support before the leaf is signed
 *   1Shot the relayer redeems the 3-hop chain (castVote executes AS the user SA) with the user's
 *         EIP-7702 upgrade in the same call; the BURNER sponsors the USDC fee (sponsored pattern)
 *
 *   pnpm 1shot:full --estimate              # Sepolia .dev rehearsal, dry quote (FREE)
 *   pnpm 1shot:full                         # Sepolia .dev rehearsal, real testnet relay
 *   pnpm 1shot:full --mainnet --estimate    # mainnet quote (FREE)
 *   pnpm 1shot:full --mainnet               # mainnet run (REAL USDC, ask-first)
 *
 * Needs in .env: VENICE_API_KEY, USER_DEMO_PK, ORCHESTRATOR_PK, ANALYST_PK, ONESHOT_BURNER_PK.
 * The burner holds the USDC war chest (fees + the user's toll budget); the analyst needs a sliver
 * of ETH to redeem the toll. Dumps oneshot-full-run.json for app/src/lib/mainnet-snapshot.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  http,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createDelegation, Implementation, ScopeType, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';
import { createCaveatBuilder } from '@metamask/smart-accounts-kit/utils';

import {
  ADDRESSES,
  VOTE_BOARD_ADDRESS,
  analyzeProposal,
  buildPaymentDelegation,
  CASTVOTE_SIGNATURE,
  DEMO_PROPOSAL_ID,
  delegationHash,
  delegationManagerAddress,
  estimate7710Transaction,
  fetchAttestation,
  floorFee,
  freshSalt,
  getCapabilities,
  getStatus,
  is7702Upgraded,
  isTerminalStatus,
  LENSES,
  PROPOSALS,
  pickPaymentToken,
  relayStatusLabel,
  resolveModel,
  send7710Transaction,
  settlePaymentCalldata,
  statusTxHash,
  synthesizeVerdict,
  toVeniceTrace,
  withVotingPolicy,
  type Delegation,
  type LensInput,
  type LensVerdict,
  type VeniceConfig,
} from '../src/index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const STATELESS_7702_IMPL = '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B' as Address;
const CASTVOTE_ABI = parseAbi([`function ${CASTVOTE_SIGNATURE} returns (uint256)`]);
const TOLL_ATOMS = 1_000n; // 0.001 USDC per query
const TOLL_BUDGET_HUMAN = '0.05'; // the user's pre-funded x402 budget
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function envKey(name: string): Hex {
  const v = process.env[name];
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`missing/invalid ${name} in .env`);
  return v as Hex;
}

function network(mainnet: boolean) {
  const a = mainnet ? ADDRESSES.baseMainnet : ADDRESSES.baseSepolia;
  // the Sepolia board lives in voteboard.ts (VOTE_BOARD_ADDRESS); addresses.ts only carries mainnet's
  const voteBoard = a.voteBoard ?? (mainnet ? undefined : VOTE_BOARD_ADDRESS);
  if (!voteBoard) throw new Error('voteBoard not set for this network');
  return mainnet
    ? {
        chainId: 8453, chain: base, name: 'base',
        rpc: process.env.BASE_MAINNET_RPC_URL || 'https://base-rpc.publicnode.com',
        relayerUrl: 'https://relayer.1shotapi.com/relayers', relayer: 'mainnet' as const,
        basescan: 'https://basescan.org', voteBoard,
      }
    : {
        chainId: 84532, chain: baseSepolia, name: 'base-sepolia',
        rpc: process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com',
        relayerUrl: 'https://relayer.1shotapi.dev/relayers', relayer: 'testnet' as const,
        basescan: 'https://sepolia.basescan.org', voteBoard,
      };
}

async function main(): Promise<void> {
  loadDotenv({ path: path.join(REPO_ROOT, '.env') });
  const mainnet = process.argv.includes('--mainnet');
  const estimateOnly = process.argv.includes('--estimate');
  const net = network(mainnet);
  const client = createPublicClient({ chain: net.chain, transport: http(net.rpc) }) as PublicClient;
  const dm = delegationManagerAddress(net.chainId);

  // ── parties ────────────────────────────────────────────────────────────────────────────────────
  const userEoa = privateKeyToAccount(envKey('USER_DEMO_PK'));
  const orchEoa = privateKeyToAccount(envKey('ORCHESTRATOR_PK'));
  const analystEoa = privateKeyToAccount(envKey('ANALYST_PK'));
  const burnerEoa = privateKeyToAccount(envKey('ONESHOT_BURNER_PK'));
  const sa = (eoa: typeof userEoa) =>
    toMetaMaskSmartAccount({ client, implementation: Implementation.Stateless7702, address: eoa.address, signer: { account: eoa } });
  const [userSA, orchSA, analystSA, burnerSA] = await Promise.all([sa(userEoa), sa(orchEoa), sa(analystEoa), sa(burnerEoa)]);
  const env = userSA.environment;

  console.log(`\n● network ${net.name} (${net.chainId}) · relayer ${net.relayer} · VoteBoard ${net.voteBoard}`);
  console.log(`● user ${userEoa.address}\n● orchestrator ${orchEoa.address}\n● analyst ${analystEoa.address}\n● burner(sponsor) ${burnerEoa.address}`);

  // ── relayer capabilities ───────────────────────────────────────────────────────────────────────
  const caps = (await getCapabilities(net.chainId, net.relayerUrl))[String(net.chainId)];
  if (!caps) throw new Error(`relayer ${net.relayer} does not support chain ${net.chainId}`);
  const usdc = pickPaymentToken({ [String(net.chainId)]: caps }, net.chainId, 'USDC');
  const { targetAddress, feeCollector } = caps;
  const dec = Number(usdc.decimals);
  const fmt = (n: bigint) => (Number(n) / 10 ** dec).toFixed(dec).replace(/0+$/, '').replace(/\.$/, '');
  console.log(`● 1Shot target ${targetAddress} · feeCollector ${feeCollector} · USDC ${usdc.address}`);

  const bal = (a: Address) => client.readContract({ address: usdc.address, abi: erc20Abi, functionName: 'balanceOf', args: [a] }) as Promise<bigint>;
  const [burnerUsdc, userUsdc] = await Promise.all([bal(burnerEoa.address), bal(userEoa.address)]);
  console.log(`● balances: burner ${fmt(burnerUsdc)} USDC · user ${fmt(userUsdc)} USDC`);

  const minFee = parseUnits('0.01', dec);
  const burnerFeeDel = async (salt?: Hex): Promise<Delegation> => {
    const d = createDelegation({
      to: targetAddress,
      from: burnerSA.address,
      environment: env,
      scope: { type: ScopeType.FunctionCall, targets: [usdc.address], selectors: ['transfer(address,uint256)'] },
      salt: salt ?? freshSalt(),
    } as Parameters<typeof createDelegation>[0]) as Delegation;
    return { ...d, signature: await burnerSA.signDelegation({ delegation: d }) } as Delegation;
  };
  const feeExec = (fee: bigint) => ({
    target: usdc.address, value: '0',
    data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [feeCollector, fee] }) as Hex,
  });

  // ── step 1 · x402: the agent's USDC budget pays the analyst's data toll (0.001 USDC) ───────────
  // The buyer is the BURNER smart account: it is the user account's SAME-ADDRESS casting wallet,
  // and crucially it is already EIP-7702-deployed, so the DelegationManager can ERC-1271-verify its
  // signature. (A counterfactual, not-yet-deployed account can't sign a standalone redeem — that's
  // why the *vote* chain rides the user's 7702 upgrade in the same relay call, but this independent
  // toll redeem needs a deployed buyer.) The toll budget already sits in the burner's USDC.
  void TOLL_BUDGET_HUMAN; void parseUnits;
  let tollTx: Hex | undefined;
  let sellerBalance = 0n;
  const tollBuyerSA = burnerSA;
  {
    const cap = parseUnits('0.1', dec);
    const d = buildPaymentDelegation({ buyer: tollBuyerSA.address, seller: analystEoa.address, asset: usdc.address, amount: cap, environment: env });
    const paymentDel = { ...d, signature: await tollBuyerSA.signDelegation({ delegation: d }) } as Delegation;
    console.log(`\n● x402: buyer(agent budget) ${tollBuyerSA.address} → seller(analyst) ${analystEoa.address} · ${fmt(TOLL_ATOMS)} USDC/query`);
    if (!estimateOnly) {
      const analystWallet = createWalletClient({ account: analystEoa, chain: net.chain, transport: http(net.rpc) });
      tollTx = await analystWallet.sendTransaction({ to: dm, data: settlePaymentCalldata(paymentDel, usdc.address, analystEoa.address, TOLL_ATOMS) });
      const rc = await client.waitForTransactionReceipt({ hash: tollTx });
      if (rc.status !== 'success') throw new Error('x402 settlement reverted');
      sellerBalance = await bal(analystEoa.address);
      console.log(`● x402 settled: tx ${tollTx} · seller balance ${fmt(sellerBalance)} USDC`);
    }
  }

  // ── step 3 · VENICE TEE: 4 lenses → synthesis → the decided support ────────────────────────────
  const proposal = PROPOSALS[0];
  const proposalText = proposal.body.en;
  const veniceCfg: VeniceConfig = {
    apiUrl: process.env.VENICE_API_URL || 'https://api.venice.ai/api/v1',
    apiKey: process.env.VENICE_API_KEY || '',
    model: process.env.VENICE_MODEL || undefined,
  };
  if (!veniceCfg.apiKey) throw new Error('VENICE_API_KEY missing in .env');
  const skipVenice = process.argv.includes('--no-venice');
  let venice: ReturnType<typeof toVeniceTrace>;
  let lenses: LensVerdict[];
  let support: 0 | 1 | 2;
  if (skipVenice) {
    console.log('\n● Venice SKIPPED (--no-venice rehearsal) — assuming For');
    support = 1;
    lenses = [];
    venice = {
      model: 'rehearsal', support, decision: 'For', rationale: 'rehearsal placeholder (no Venice call)',
      attestation: { verified: false }, signature: { recovered: false },
    } as ReturnType<typeof toVeniceTrace>;
  } else {
    console.log('\n● Venice TEE: resolving model + running the 4-lens committee…');
    const model = await resolveModel(veniceCfg);
    const lensResults = await Promise.all(
      LENSES.map(async (lens) => ({ lens, analysis: await analyzeProposal(veniceCfg, withVotingPolicy(proposalText, lens.policy), model) })),
    );
    lenses = lensResults.map(({ lens, analysis }) => ({
      lens: lens.key, model: analysis.model, support: analysis.decision.support,
      decision: analysis.decision.decision, rationale: analysis.decision.rationale,
      reasoning: analysis.reasoning, teeVerified: analysis.tee.verified,
    }));
    for (const l of lenses) console.log(`   ${l.lens.padEnd(14)} ${l.decision}`);
    const inputs: LensInput[] = lensResults.map(({ lens, analysis }) => ({ label: lens.label, decision: analysis.decision.decision, rationale: analysis.decision.rationale }));
    const synthesis = await synthesizeVerdict(veniceCfg, proposalText, inputs, model);
    const attestation = await fetchAttestation(veniceCfg, synthesis.model).catch(() => undefined);
    venice = toVeniceTrace(synthesis, attestation);
    support = synthesis.decision.support;
    console.log(`● Venice decision: ${venice.decision} (support=${support}) · "${venice.rationale}"`);
  }

  // ── step 4 · the 3-hop A2A chain (leaf locked to the DECIDED vote) ──────────────────────────────
  const board = net.voteBoard as Address;
  const voteOnly = { type: ScopeType.FunctionCall, targets: [board], selectors: [CASTVOTE_SIGNATURE] };
  const expiry = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;

  const rootRaw = createDelegation({
    to: orchSA.address, from: userSA.address, environment: env, salt: freshSalt(),
    scope: voteOnly,
    caveats: createCaveatBuilder(env)
      .addCaveat('timestamp', { afterThreshold: 0, beforeThreshold: expiry })
      .addCaveat('limitedCalls', { limit: 3 }),
  } as Parameters<typeof createDelegation>[0]) as Delegation;
  const root = { ...rootRaw, signature: await userSA.signDelegation({ delegation: rootRaw }) } as Delegation;

  const midRaw = createDelegation({
    to: analystSA.address, from: orchSA.address, environment: env, salt: freshSalt(),
    scope: voteOnly,
    caveats: createCaveatBuilder(env).addCaveat('limitedCalls', { limit: 1 }),
    parentDelegation: root,
  } as Parameters<typeof createDelegation>[0]) as Delegation;
  const mid = { ...midRaw, signature: await orchSA.signDelegation({ delegation: midRaw }) } as Delegation;

  // the leaf is signed ONLY AFTER Venice rules: calldata locked to castVote(proposalId, decidedSupport)
  const leafRaw = createDelegation({
    to: targetAddress, from: analystSA.address, environment: env, salt: freshSalt(),
    scope: {
      type: ScopeType.FunctionCall, targets: [board], selectors: [CASTVOTE_SIGNATURE],
      allowedCalldata: [{
        startIndex: 4,
        value: encodeAbiParameters(
          [{ name: 'proposalId', type: 'uint256' }, { name: 'support', type: 'uint8' }],
          [DEMO_PROPOSAL_ID, support],
        ),
      }],
    },
    parentDelegation: mid,
  } as Parameters<typeof createDelegation>[0]) as Delegation;
  const leaf = { ...leafRaw, signature: await analystSA.signDelegation({ delegation: leafRaw }) } as Delegation;

  const hashes = {
    root: delegationHash(root, net.chainId, dm),
    mid: delegationHash(mid, net.chainId, dm),
    leaf: delegationHash(leaf, net.chainId, dm),
  };
  console.log(`\n● chain: root ${hashes.root.slice(0, 10)}… → mid ${hashes.mid.slice(0, 10)}… → leaf ${hashes.leaf.slice(0, 10)}…`);

  // ── step 5 · 1SHOT: redeem the chain (vote AS the user SA) + sponsored fee + user 7702 upgrade ──
  const castData = encodeFunctionData({ abi: CASTVOTE_ABI, functionName: 'castVote', args: [DEMO_PROPOSAL_ID, support] });
  const voteTxn = { permissionContext: [leaf, mid, root], executions: [{ target: board, value: '0', data: castData }] };
  const sponsorDel = await burnerFeeDel();

  let authorizationList: unknown[] | undefined;
  const userCode = ((await client.getCode({ address: userEoa.address })) ?? '0x') as Hex;
  if (!is7702Upgraded(userCode)) {
    const nonce = await client.getTransactionCount({ address: userEoa.address, blockTag: 'pending' });
    const auth = await userEoa.signAuthorization({ chainId: net.chainId, contractAddress: STATELESS_7702_IMPL, nonce });
    authorizationList = [{ address: auth.address, chainId: auth.chainId, nonce: auth.nonce, r: auth.r, s: auth.s, yParity: auth.yParity }];
    console.log('● EIP-7702: user upgrade rides THIS relay call (authorizationList)');
  } else {
    console.log('● user already 7702-upgraded');
  }

  const estParams = {
    chainId: String(net.chainId),
    ...(authorizationList ? { authorizationList } : {}),
    transactions: [voteTxn, { permissionContext: [sponsorDel], executions: [feeExec(minFee)] }],
  };
  const est = await estimate7710Transaction(estParams as Parameters<typeof estimate7710Transaction>[0], net.relayerUrl);
  if (!est.success) throw new Error(`vote estimate failed: ${JSON.stringify(est.error)}`);
  const fee = floorFee(BigInt(est.requiredPaymentAmount ?? '0'), minFee);
  console.log(`● estimate ok — relay fee ${fmt(fee)} USDC (sponsor: burner)`);

  if (estimateOnly) {
    console.log('\n--estimate only — no broadcast. Re-run without --estimate to relay + record.\n');
    return;
  }

  const sendParams = {
    chainId: String(net.chainId),
    ...(authorizationList ? { authorizationList } : {}),
    transactions: [voteTxn, { permissionContext: [sponsorDel], executions: [feeExec(fee)] }],
    context: est.context,
  };
  const taskId = await send7710Transaction(sendParams as Parameters<typeof send7710Transaction>[0], net.relayerUrl);
  const voteTx = await waitTask(taskId, net.relayerUrl, 'vote');

  // verify on-chain: the voter of record is the USER smart account
  const GET_VOTE_ABI = parseAbi(['function getVote(uint256 proposalId, address voter) view returns (uint8)']);
  const ballot = (await client
    .readContract({ address: board, abi: GET_VOTE_ABI, functionName: 'getVote', args: [DEMO_PROPOSAL_ID, userSA.address] })
    .catch(() => undefined)) as number | undefined; // 0 = not voted, else support+1
  const rc = await client.getTransactionReceipt({ hash: voteTx });
  const upgradedNow = is7702Upgraded(((await client.getCode({ address: userEoa.address })) ?? '0x') as Hex);
  console.log(`\n✅ castVote relayed — tx ${voteTx} · block ${rc.blockNumber} · gasUsed ${rc.gasUsed}`);
  console.log(`   voter = user SA ${userSA.address} ${ballot != null ? `(ballot=${ballot}: ${ballot === 0 ? 'NOT RECORDED!' : `support=${ballot - 1}`})` : ''}`);
  console.log(`   user 7702-upgraded: ${upgradedNow} · fee ${fmt(fee)} USDC paid by sponsor(burner)`);

  // ── snapshot ────────────────────────────────────────────────────────────────────────────────────
  const snapshot = {
    recordedAt: new Date().toISOString(),
    chain: { id: net.chainId, name: net.name, rpc: net.rpc, basescan: net.basescan },
    relayer: net.relayer,
    proposal: { id: DEMO_PROPOSAL_ID.toString(), title: proposal.title, body: proposal.body },
    voteBoard: board,
    chainFlow: {
      participants: { user: userSA.address, orchestrator: orchSA.address, analyst: analystEoa.address },
      hashes,
      bounds: { rootMaxVotes: 3, rootExpiry: expiry, midLimit: 1, leafLock: `castVote(${DEMO_PROPOSAL_ID.toString().slice(0, 8)}…, ${support})` },
    },
    venice,
    lenses,
    vote: { txHash: voteTx, support, blockNumber: rc.blockNumber.toString(), relay: '1shot', gasUsed: Number(rc.gasUsed) },
    oneshot: { burner: burnerEoa.address, sponsor: burnerEoa.address, feeUsdc: fmt(fee), gasUsed: Number(rc.gasUsed), feeCollector, relayer: rc.from },
    toll: tollTx
      ? { txHash: tollTx, asset: usdc.address, buyer: tollBuyerSA.address, seller: analystEoa.address, amount: TOLL_ATOMS.toString(), sellerBalance: sellerBalance.toString(), resource: `/context/proposal-${DEMO_PROPOSAL_ID.toString().slice(-6)}` }
      : undefined,
  };
  const out = path.join(REPO_ROOT, 'oneshot-full-run.json');
  fs.writeFileSync(out, JSON.stringify(snapshot, null, 2));
  console.log(`\n📄 snapshot → ${out}\n   merge into app/src/lib/mainnet-snapshot.ts (MAINNET_SNAPSHOT)\n`);
}

async function waitTask(taskId: Hex, relayerUrl: string, label: string): Promise<Hex> {
  console.log(`● ${label}: submitted — taskId ${taskId}`);
  for (let i = 0; i < 60; i++) {
    const st = await getStatus(taskId, relayerUrl);
    console.log(`   ${relayStatusLabel(st.status)} (${st.status})${statusTxHash(st) ? ` · ${statusTxHash(st)}` : ''}`);
    if (isTerminalStatus(st.status)) {
      if (st.status !== 200) throw new Error(`${label} relay ${relayStatusLabel(st.status)}: ${st.message ?? ''}`);
      const tx = statusTxHash(st);
      if (!tx) throw new Error(`${label}: confirmed but no tx hash in status`);
      return tx;
    }
    await sleep(3000);
  }
  throw new Error(`${label}: relay did not reach a terminal status in time`);
}

main().catch((e) => {
  console.error('\n1shot-record-full FAILED:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
