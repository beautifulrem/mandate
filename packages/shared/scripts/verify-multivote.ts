/**
 * SD-8 Phase-2 end-to-end (FAUCET): prove standing authority + revoke-blocks-next.
 *   1. provision + sign ONE standing grant
 *   2. /grant            → vote on proposal A
 *   3. /vote-again (B)   → vote on a DIFFERENT proposal, NO new signature (reuses the cached chain)
 *   4. revoke            → disableDelegation on the root (UserOp from the funded SA)
 *   5. /vote-again (C)   → must FAIL on-chain (delegation disabled)
 *
 *   FAUCET_PK=0x… ORCH=http://localhost:8787 pnpm tsx packages/shared/scripts/verify-multivote.ts
 */
import { createPublicClient, erc20Abi, http, type Address, type Hex } from 'viem';
import { createBundlerClient } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { getSmartAccountsEnvironment, Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';
import {
  ADDRESSES,
  PROPOSALS,
  VOTE_BOARD_ADDRESS,
  buildPaymentDelegation,
  buildStandingVoteDelegation,
  delegationManagerAddress,
  revokeRootCalldata,
  type Delegation,
} from '../src/index.js';

const RPC = process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com';
const ORCH = process.env.ORCH || 'http://localhost:8787';
const BUNDLER = process.env.NEXT_PUBLIC_BUNDLER_URL || 'https://public.pimlico.io/v2/84532/rpc';
const PK = process.env.FAUCET_PK as Hex;

const post = (path: string, body: unknown) =>
  fetch(`${ORCH}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

async function pollRun(runId: string, label: string) {
  for (let i = 0; i < 45; i++) {
    const run = await fetch(`${ORCH}/run/${runId}`).then((r) => r.json());
    if (['voted', 'failed', 'revoked'].includes(run.status)) {
      const extra = run.vote?.txHash ? `vote ${run.vote.txHash}` : run.error ? JSON.stringify(run.error) : '';
      console.log(`   ${label}: status=${run.status} ${run.venice?.decision ?? ''} ${extra}`);
      return run;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(`   ${label}: TIMEOUT`);
  return null;
}

async function main() {
  if (!PK) throw new Error('FAUCET_PK not set');
  const client = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
  const eoa = privateKeyToAccount(PK);
  const sa = await toMetaMaskSmartAccount({
    client, implementation: Implementation.Hybrid,
    deployParams: [eoa.address, [], [], []], deploySalt: '0x', signer: { account: eoa },
  });
  const [A, B, C] = PROPOSALS;
  console.log(`SA ${sa.address}`);

  console.log('[1] provision + sign ONE standing grant');
  await post('/provision', { eoa: eoa.address });
  const environment = getSmartAccountsEnvironment(baseSepolia.id);
  const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const root = buildStandingVoteDelegation({
    governor: VOTE_BOARD_ADDRESS, delegate: ADDRESSES.accounts.orchestrator as Address,
    delegator: sa.address, environment, maxVotes: 10, expiry,
  });
  const rootSigned: Delegation = { ...root, signature: (await sa.signDelegation({ delegation: root })) as Hex };

  // SECOND signature — the cumulative x402 budget (userSA -> analyst seller): at most maxVotes x 1 mUSDC.
  const paymentToken = ADDRESSES.baseSepolia.paymentToken as Address;
  const seller = ADDRESSES.accounts.analyst as Address;
  const payment = buildPaymentDelegation({ buyer: sa.address, seller, asset: paymentToken, amount: 10n * 1_000_000n, environment });
  const paymentSigned: Delegation = { ...payment, signature: (await sa.signDelegation({ delegation: payment })) as Hex };

  const mUSDC = (who: Address) =>
    client.readContract({ address: paymentToken, abi: erc20Abi, functionName: 'balanceOf', args: [who] }) as Promise<bigint>;
  const fmt = (n: bigint) => (Number(n) / 1e6).toFixed(2);
  console.log(`   mUSDC before — buyerSA ${fmt(await mUSDC(sa.address))} · seller ${fmt(await mUSDC(seller))}`);

  console.log(`[2] /grant → vote on A (#${A.id.toString().slice(-3)})`);
  const { runId } = await post('/grant', {
    chainId: 84532, governor: VOTE_BOARD_ADDRESS, proposalId: A.id.toString(), proposalText: A.body.en, rootDelegation: rootSigned, paymentDelegation: paymentSigned,
  });
  await pollRun(runId, 'vote A');
  console.log(`   mUSDC after A — buyerSA ${fmt(await mUSDC(sa.address))} · seller ${fmt(await mUSDC(seller))}`);

  console.log(`[3] /vote-again → vote on B (#${B.id.toString().slice(-3)}) — NO new signature`);
  const { runId: runB } = await post('/vote-again', { runId, proposalId: B.id.toString(), proposalText: B.body.en });
  await pollRun(runB, 'vote B');
  console.log(`   mUSDC after B — buyerSA ${fmt(await mUSDC(sa.address))} · seller ${fmt(await mUSDC(seller))}`);

  console.log('[4] revoke — disableDelegation on the root (UserOp from the SA)');
  const bundler = createBundlerClient({ client, transport: http(BUNDLER) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opHash = await bundler.sendUserOperation({ account: sa as any, calls: [{ to: delegationManagerAddress(84532), data: revokeRootCalldata(rootSigned) }] });
  const receipt = await bundler.waitForUserOperationReceipt({ hash: opHash });
  console.log(`   revoked tx ${receipt.receipt.transactionHash}`);

  console.log(`[5] /vote-again → vote on C (#${C.id.toString().slice(-3)}) — must FAIL (revoked)`);
  const { runId: runC } = await post('/vote-again', { runId, proposalId: C.id.toString(), proposalText: C.body.en });
  const cRun = await pollRun(runC, 'vote C');

  console.log('\nRESULT:', cRun?.status === 'failed' ? 'PASS ✓ (C correctly reverted after revoke)' : `UNEXPECTED (C status=${cRun?.status})`);
}

main().catch((e) => {
  console.error('verify-multivote FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});
