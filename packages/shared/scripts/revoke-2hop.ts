/**
 * T7 integration: cause-proven cascade-revoke ("kill the chain") on Base Sepolia.
 *
 * Builds a FRESH, signed, redeemable 2-hop chain (the user SA has NOT voted on this proposal),
 * confirms it WOULD redeem, then the user SA disables the ROOT delegation via a UserOp
 * (relayed through a keyless public bundler). The same chain then reverts in simulation —
 * provably because the root is disabled, not because of a prior vote.
 *
 *   pnpm tsx packages/shared/scripts/revoke-2hop.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { createBundlerClient } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  getSmartAccountsEnvironment,
  Implementation,
  toMetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit';

import {
  ADDRESSES,
  buildVoteDelegation,
  canRedeem,
  delegationManagerAddress,
  demoProposalAction,
  fetchProposalWindow,
  GOVERNOR_ABI,
  redeemVoteCalldata,
  redelegateVote,
  reseedProposal,
  revokeRootCalldata,
  type Delegation,
  type SmartAccountsEnvironment,
} from '../src/index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const RPC = process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com';
const BUNDLER = process.env.BUNDLER_RPC_URL || 'https://public.pimlico.io/v2/84532/rpc';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function env(name: string): Hex {
  const v = process.env[name];
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`missing/invalid ${name} in .env`);
  return v as Hex;
}

async function main(): Promise<void> {
  loadDotenv({ path: path.join(REPO_ROOT, '.env') });
  const governor = ADDRESSES.baseSepolia.governor;
  const token = ADDRESSES.baseSepolia.token;
  if (!governor || !token) throw new Error('deploy first (addresses.ts.baseSepolia empty)');

  const client = createPublicClient({ chain: baseSepolia, transport: http(RPC) }) as PublicClient;
  const environment: SmartAccountsEnvironment = getSmartAccountsEnvironment(baseSepolia.id);
  const dm = delegationManagerAddress(baseSepolia.id);

  const userEoa = privateKeyToAccount(env('USER_DEMO_PK'));
  const orchEoa = privateKeyToAccount(env('ORCHESTRATOR_PK'));
  const analystEoa = privateKeyToAccount(env('ANALYST_PK'));
  const deployer = privateKeyToAccount(env('DEPLOYER_PK'));

  const userSA = await toMetaMaskSmartAccount({
    client, implementation: Implementation.Hybrid,
    deployParams: [userEoa.address, [], [], []], deploySalt: '0x', signer: { account: userEoa },
  });
  const orchSA = await toMetaMaskSmartAccount({
    client, implementation: Implementation.Hybrid,
    deployParams: [orchEoa.address, [], [], []], deploySalt: '0x', signer: { account: orchEoa },
  });
  if (!(await userSA.isDeployed())) throw new Error('run vote-2hop first to deploy the smart accounts');

  // (1) fresh proposal so the user SA has NOT voted on it.
  console.log('› reseeding a fresh proposal (the user SA has not voted on it)…');
  const description = `Mandate revoke proof @ ${new Date().toISOString()}`;
  const deployerWallet = createWalletClient({ account: deployer, chain: baseSepolia, transport: http(RPC) });
  const proposeTx = await reseedProposal(deployerWallet, deployer, governor, token, description);
  await client.waitForTransactionReceipt({ hash: proposeTx });
  const { targets, values, calldatas } = demoProposalAction(token);
  const proposalId = (await client.readContract({
    address: governor, abi: GOVERNOR_ABI, functionName: 'hashProposal',
    args: [targets as Address[], values as bigint[], calldatas as Hex[], keccak256(stringToHex(description))],
  })) as bigint;
  for (;;) {
    const { window } = await fetchProposalWindow(client, governor, proposalId);
    if (window.phase === 'active') break;
    if (window.phase === 'closed') throw new Error('closed before active');
    await sleep(5000);
  }
  console.log(`  proposalId ${proposalId} Active`);

  // (2) build + sign a fresh redeemable chain (do NOT redeem).
  const root: Delegation = buildVoteDelegation({ governor, proposalId, delegate: orchSA.address, delegator: userSA.address, environment });
  const rootSigned: Delegation = { ...root, signature: await userSA.signDelegation({ delegation: root }) };
  const redel: Delegation = redelegateVote({ governor, proposalId, delegate: analystEoa.address, delegator: orchSA.address, environment, parentDelegation: rootSigned });
  const redelSigned: Delegation = { ...redel, signature: await orchSA.signDelegation({ delegation: redel }) };
  const redeemData = redeemVoteCalldata({ chain: [redelSigned, rootSigned], governor, proposalId, support: 1 });

  // (3) before disabling, the chain WOULD redeem.
  const before = await canRedeem(client, dm, redeemData, analystEoa.address);
  console.log(`\n  canRedeem BEFORE disable: ${before}  (expect true)`);

  // (4) user SA disables the ROOT delegation via a UserOp through the keyless bundler.
  console.log('› user SA disabling the root delegation (UserOp via bundler)…');
  const bundler = createBundlerClient({ client, transport: http(BUNDLER) });
  const disableData = revokeRootCalldata(rootSigned);
  const userOpHash = await bundler.sendUserOperation({
    account: userSA,
    calls: [{ to: dm, data: disableData }],
  });
  const opRcpt = await bundler.waitForUserOperationReceipt({ hash: userOpHash });
  console.log(`  disable UserOp included: ${opRcpt.receipt.transactionHash} (success=${opRcpt.success})`);

  // (5) the SAME chain now reverts in simulation — caused by the disabled root.
  const after = await canRedeem(client, dm, redeemData, analystEoa.address);
  console.log(`  canRedeem AFTER disable : ${after}  (expect false)`);

  if (!before || after) throw new Error(`revoke not cause-proven (before=${before}, after=${after})`);
  console.log('\n✅ kill-the-chain: a fresh redeemable chain reverts only after the root is disabled.');
}

main().catch((e) => { console.error('\nrevoke-2hop FAILED:', e instanceof Error ? e.message : e); process.exitCode = 1; });
