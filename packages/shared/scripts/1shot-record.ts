/**
 * Record a UNIFIED 1Shot run for the OneShotFinale replay: the Venice TEE committee (4 lenses +
 * synthesis) DECIDES the support, then that decided castVote is relayed through the 1Shot
 * permissionless relayer (EIP-7702 burner upgrade + ERC-7710 bundle, gas paid in USDC). Dumps a
 * MainnetSnapshot JSON — copy it into app/src/lib/mainnet-snapshot.ts to drive the replay.
 *
 *   pnpm tsx packages/shared/scripts/1shot-record.ts --estimate            # Sepolia .dev, dry quote (FREE)
 *   pnpm tsx packages/shared/scripts/1shot-record.ts                       # Sepolia .dev, real relay (testnet USDC)
 *   pnpm tsx packages/shared/scripts/1shot-record.ts --mainnet --estimate  # mainnet .com quote (FREE)
 *   pnpm tsx packages/shared/scripts/1shot-record.ts --mainnet             # mainnet .com real relay (REAL USDC, ask-first)
 *
 * Needs in .env: VENICE_API_KEY, ONESHOT_BURNER_PK. The burner needs a little of the relayer's fee
 * token (testnet USDC on Sepolia, real USDC on mainnet); gas is paid BY the relayer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  http,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createDelegation,
  Implementation,
  ScopeType,
  toMetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit';

import {
  ADDRESSES,
  analyzeProposal,
  buildSend7710Params,
  estimate7710Transaction,
  fetchAttestation,
  floorFee,
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
  synthesizeVerdict,
  toVeniceTrace,
  withVotingPolicy,
  type LensInput,
  type LensVerdict,
  type VeniceConfig,
} from '../src/index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const STATELESS_7702_IMPL = getAddress('0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B');
const CASTVOTE_ABI = parseAbi(['function castVote(uint256 proposalId, uint8 support) returns (uint256)']);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Network {
  chainId: number;
  chain: typeof base | typeof baseSepolia;
  name: string;
  rpc: string;
  relayerUrl: string;
  relayer: 'mainnet' | 'testnet';
  basescan: string;
  governor: Address;
  proposalId: string;
}

function network(mainnet: boolean): Network {
  if (mainnet) {
    const a = ADDRESSES.baseMainnet;
    if (!a.governor || !a.proposalId) throw new Error('ADDRESSES.baseMainnet.{governor,proposalId} not set');
    return {
      chainId: 8453, chain: base, name: 'base',
      rpc: process.env.BASE_MAINNET_RPC_URL || 'https://base-rpc.publicnode.com',
      relayerUrl: 'https://relayer.1shotapi.com/relayers', relayer: 'mainnet',
      basescan: 'https://basescan.org', governor: a.governor, proposalId: a.proposalId,
    };
  }
  const a = ADDRESSES.baseSepolia;
  if (!a.governor || !a.proposalId) throw new Error('ADDRESSES.baseSepolia.{governor,proposalId} not set');
  return {
    chainId: 84532, chain: baseSepolia, name: 'base-sepolia',
    rpc: process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com',
    relayerUrl: 'https://relayer.1shotapi.dev/relayers', relayer: 'testnet',
    basescan: 'https://sepolia.basescan.org', governor: a.governor, proposalId: a.proposalId,
  };
}

function envKey(name: string): Hex {
  const v = process.env[name];
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`missing/invalid ${name} in .env`);
  return v as Hex;
}

async function main(): Promise<void> {
  loadDotenv({ path: path.join(REPO_ROOT, '.env') });
  const estimateOnly = process.argv.includes('--estimate');
  const net = network(process.argv.includes('--mainnet'));

  // The on-chain governor proposal we cast on == PROPOSALS[0] (DEMO_PROPOSAL_ID) semantically; use its
  // title/body as the text Venice analyzes and as the snapshot's displayed proposal.
  const proposal = PROPOSALS[0];
  const proposalText = proposal.body.en;
  const proposalId = BigInt(net.proposalId);

  console.log(`\n● network: ${net.name} (${net.chainId}) · relayer ${net.relayer} · governor ${net.governor}`);
  console.log(`● proposal: "${proposal.title.en}"  id ${net.proposalId.slice(0, 12)}…\n`);

  // ── 1) VENICE TEE: 4 lenses in parallel → synthesis → final support ───────────────────────────
  const veniceCfg: VeniceConfig = {
    apiUrl: process.env.VENICE_API_URL || 'https://api.venice.ai/api/v1',
    apiKey: process.env.VENICE_API_KEY || '',
    model: process.env.VENICE_MODEL || undefined,
  };
  if (!veniceCfg.apiKey) throw new Error('VENICE_API_KEY missing in .env');
  console.log('● Venice TEE: resolving model + running the 4-lens committee…');
  const model = await resolveModel(veniceCfg);
  const lensResults = await Promise.all(
    LENSES.map(async (lens) => ({ lens, analysis: await analyzeProposal(veniceCfg, withVotingPolicy(proposalText, lens.policy), model) })),
  );
  const lenses: LensVerdict[] = lensResults.map(({ lens, analysis }) => ({
    lens: lens.key, model: analysis.model, support: analysis.decision.support,
    decision: analysis.decision.decision, rationale: analysis.decision.rationale,
    reasoning: analysis.reasoning, teeVerified: analysis.tee.verified,
  }));
  for (const l of lenses) console.log(`   ${l.lens.padEnd(14)} ${l.decision}`);
  const inputs: LensInput[] = lensResults.map(({ lens, analysis }) => ({ label: lens.label, decision: analysis.decision.decision, rationale: analysis.decision.rationale }));
  const synthesis = await synthesizeVerdict(veniceCfg, proposalText, inputs, model);
  const attestation = await fetchAttestation(veniceCfg, synthesis.model).catch(() => undefined);
  const venice = toVeniceTrace(synthesis, attestation);
  const support = synthesis.decision.support;
  console.log(`● Venice decision: ${venice.decision} (support=${support}) · "${venice.rationale}"\n`);

  // ── 2) 1SHOT RELAY: burner 7702 upgrade + ERC-7710 bundle [ fee → feeCollector , castVote ] ────
  const client = createPublicClient({ chain: net.chain, transport: http(net.rpc) }) as PublicClient;
  const caps = (await getCapabilities(net.chainId, net.relayerUrl))[String(net.chainId)];
  if (!caps) throw new Error(`relayer ${net.relayer} does not support chain ${net.chainId}`);
  const usdc = pickPaymentToken({ [String(net.chainId)]: caps }, net.chainId, 'USDC');
  const { targetAddress, feeCollector } = caps;
  console.log(`● 1Shot: target ${targetAddress} · feeCollector ${feeCollector} · USDC ${usdc.address}`);

  const burnerEoa = privateKeyToAccount(envKey('ONESHOT_BURNER_PK'));
  const burnerSA = await toMetaMaskSmartAccount({
    client, implementation: Implementation.Stateless7702, address: burnerEoa.address, signer: { account: burnerEoa },
  });
  console.log(`● burner ${burnerEoa.address} (7702 SA = same address)`);

  const code = (await client.getCode({ address: burnerEoa.address })) ?? '0x';
  let authorizationList: unknown[] | undefined;
  if (!is7702Upgraded(code as Hex)) {
    const nonce = await client.getTransactionCount({ address: burnerEoa.address, blockTag: 'pending' });
    const auth = await burnerEoa.signAuthorization({ chainId: net.chainId, contractAddress: STATELESS_7702_IMPL, nonce });
    authorizationList = [{ address: auth.address, chainId: auth.chainId, nonce: auth.nonce, r: auth.r, s: auth.s, yParity: auth.yParity }];
    console.log('● EIP-7702 authorization signed (first-use upgrade through 1Shot)');
  } else {
    console.log('● burner already 7702-upgraded — no authorization needed');
  }

  const delegation = createDelegation({
    to: targetAddress, from: burnerSA.address, environment: burnerSA.environment,
    scope: { type: ScopeType.FunctionCall, targets: [usdc.address, net.governor], selectors: ['transfer(address,uint256)', 'castVote(uint256,uint8)'] },
  } as Parameters<typeof createDelegation>[0]);
  const signedDelegation = { ...delegation, signature: await burnerSA.signDelegation({ delegation }) };

  const castVoteData = encodeFunctionData({ abi: CASTVOTE_ABI, functionName: 'castVote', args: [proposalId, support] });
  const minFeeAtoms = parseUnits('0.01', Number(usdc.decimals));
  const execs = (fee: bigint) => [
    { target: usdc.address, value: '0', data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [feeCollector, fee] }) as Hex },
    { target: net.governor, value: '0', data: castVoteData },
  ];

  const estParams = buildSend7710Params({ chainId: net.chainId, permissionContext: [signedDelegation], executions: execs(minFeeAtoms), authorizationList });
  const est = await estimate7710Transaction(estParams, net.relayerUrl);
  if (!est.success) throw new Error(`estimate failed: ${JSON.stringify(est.error)}`);
  const feeAtoms = floorFee(BigInt(est.requiredPaymentAmount ?? '0'), minFeeAtoms);
  console.log(`● estimate ok: fee ${Number(feeAtoms) / 10 ** Number(usdc.decimals)} USDC`);

  if (estimateOnly) {
    console.log('\n--estimate only — no broadcast. Re-run without --estimate to relay + record.\n');
    return;
  }

  const sendParams = { ...buildSend7710Params({ chainId: net.chainId, permissionContext: [signedDelegation], executions: execs(feeAtoms), authorizationList }), context: est.context };
  const taskId = await send7710Transaction(sendParams, net.relayerUrl);
  console.log(`● submitted — taskId ${taskId}`);

  let voteTx: Hex | undefined;
  for (let i = 0; i < 60; i++) {
    const st = await getStatus(taskId, net.relayerUrl);
    console.log(`   ${relayStatusLabel(st.status)} (${st.status})${st.hash ? ` · ${st.hash}` : ''}`);
    if (isTerminalStatus(st.status)) {
      if (st.status !== 200) throw new Error(`relay ${relayStatusLabel(st.status)}: ${st.message ?? ''}`);
      voteTx = st.hash;
      break;
    }
    await sleep(3000);
  }
  if (!voteTx) throw new Error('relay did not reach a terminal status in time');

  const receipt = await client.getTransactionReceipt({ hash: voteTx });
  const upgraded = is7702Upgraded((await client.getCode({ address: burnerEoa.address })) as Hex);
  console.log(`\n✅ ${net.name} castVote relayed via 1Shot — tx ${voteTx} · 7702-upgraded ${upgraded}`);

  // ── 3) DUMP the MainnetSnapshot JSON ──────────────────────────────────────────────────────────
  const snapshot = {
    recordedAt: new Date().toISOString(),
    chain: { id: net.chainId, name: net.name, rpc: net.rpc, basescan: net.basescan },
    relayer: net.relayer,
    proposal: { id: net.proposalId, title: proposal.title, body: proposal.body },
    participants: { user: burnerSA.address, orchestrator: burnerSA.address, analyst: targetAddress },
    venice, lenses,
    vote: { txHash: voteTx, support, blockNumber: receipt.blockNumber.toString(), relay: '1shot' },
    oneshot: { burner: burnerEoa.address, feeUsdc: (Number(feeAtoms) / 10 ** Number(usdc.decimals)).toString(), gasUsed: Number(receipt.gasUsed) },
  };
  const out = path.join(REPO_ROOT, `oneshot-snapshot-${net.relayer}.json`);
  fs.writeFileSync(out, JSON.stringify(snapshot, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  console.log(`\n📄 snapshot written → ${out}`);
  console.log('   paste it into app/src/lib/mainnet-snapshot.ts (MAINNET_SNAPSHOT)\n');
}

main().catch((e) => { console.error('\n1shot-record FAILED:', e instanceof Error ? e.message : e); process.exitCode = 1; });
