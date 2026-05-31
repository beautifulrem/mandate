/**
 * The orchestrator's autonomous loop for one grant: attenuated-redelegate (standing) to the analyst,
 * then have the analyst decide in the Venice TEE and cast. The standing chain (root + signed
 * redelegation) is cached per runId, so the SAME grant can vote on FURTHER proposals with NO new
 * user signature — the on-chain LimitedCalls + Timestamp caveats (and a revoke) are what bound/stop it.
 */
import { createPublicClient, createWalletClient, http, type Address, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { getSmartAccountsEnvironment, Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';
import {
  delegationHash,
  delegationManagerAddress,
  redelegateStandingVote,
  type Delegation,
  type GrantRequest,
  type VeniceConfig,
} from '@mandate/shared';
import { runAnalystVote } from '@mandate/analyst';
import type { RunStore } from './runStore.js';

export interface OrchestratorConfig {
  rpcUrl: string;
  orchestratorPk: Hex;
  analystPk: Hex;
  veniceCfg: VeniceConfig;
}

/** The standing delegation chain for a grant, cached so further proposals reuse it (no re-sign). */
interface ChainBundle {
  root: Delegation;
  redelSigned: Delegation;
  governor: Address;
  chainId: number;
  redelegationHash: Hex;
}
const chains = new Map<string, ChainBundle>();

/** The cached standing chain's metadata for a run (undefined if it can't vote-again). */
export function chainMeta(runId: string): { chainId: number; governor: Address } | undefined {
  const b = chains.get(runId);
  return b ? { chainId: b.chainId, governor: b.governor } : undefined;
}

/** Analyst decides in the Venice TEE and redeems the cached chain to cast `proposalId`. */
async function cast(
  store: RunStore,
  runId: string,
  bundle: ChainBundle,
  proposalId: bigint,
  proposalText: string,
  cfg: OrchestratorConfig,
): Promise<void> {
  const client = createPublicClient({ chain: baseSepolia, transport: http(cfg.rpcUrl) }) as PublicClient;
  const dm = delegationManagerAddress(bundle.chainId);
  const analystEoa = privateKeyToAccount(cfg.analystPk);
  store.patch(runId, { status: 'analyzing' });
  const analystWallet = createWalletClient({ account: analystEoa, chain: baseSepolia, transport: http(cfg.rpcUrl) });
  const result = await runAnalystVote(
    { publicClient: client, analystWallet, analystAccount: analystEoa, delegationManager: dm, veniceCfg: cfg.veniceCfg },
    { chain: [bundle.redelSigned, bundle.root], governor: bundle.governor, proposalId, proposalText },
  );
  store.patch(runId, { status: 'decided', venice: result.trace });
  store.patch(runId, { status: 'voted', vote: result.vote });
}

/** Drive one grant end-to-end: redelegate (standing) → cache the chain → cast the first proposal. */
export async function runVote(
  store: RunStore,
  runId: string,
  grant: GrantRequest,
  cfg: OrchestratorConfig,
): Promise<void> {
  try {
    const client = createPublicClient({ chain: baseSepolia, transport: http(cfg.rpcUrl) }) as PublicClient;
    const environment = getSmartAccountsEnvironment(grant.chainId);
    const dm = delegationManagerAddress(grant.chainId);
    const orchEoa = privateKeyToAccount(cfg.orchestratorPk);
    const orchSA = await toMetaMaskSmartAccount({
      client, implementation: Implementation.Hybrid,
      deployParams: [orchEoa.address, [], [], []], deploySalt: '0x', signer: { account: orchEoa },
    });
    const analystEoa = privateKeyToAccount(cfg.analystPk);
    const governor = grant.governor as Address;
    const root = grant.rootDelegation as unknown as Delegation;

    // attenuated redelegation orchestrator → analyst (standing: same vote-only scope, any proposal)
    const redel = redelegateStandingVote({
      governor, delegate: analystEoa.address, delegator: orchSA.address, environment, parentDelegation: root,
    });
    const redelSigned = {
      ...redel,
      signature: (await orchSA.signDelegation({ delegation: redel })) as Hex,
    } as Delegation;
    const redelegationHash = delegationHash(redelSigned, grant.chainId, dm);
    store.patch(runId, { status: 'redelegated', redelegationHash });

    const bundle: ChainBundle = { root, redelSigned, governor, chainId: grant.chainId, redelegationHash };
    chains.set(runId, bundle);
    await cast(store, runId, bundle, BigInt(grant.proposalId), grant.proposalText, cfg);
  } catch (err) {
    store.patch(runId, {
      status: 'failed',
      error: { code: 'INTERNAL', message: err instanceof Error ? err.message : String(err) },
    });
  }
}

/** Vote again on a NEW proposal reusing the cached standing chain — NO new user signature.
 *  Reverts on-chain (→ run 'failed') if the grant is exhausted (LimitedCalls), expired
 *  (Timestamp), or revoked (disableDelegation) — which is exactly the kill-switch made visible. */
export async function voteAgain(
  store: RunStore,
  fromRunId: string,
  newRunId: string,
  proposalId: bigint,
  proposalText: string,
  cfg: OrchestratorConfig,
): Promise<void> {
  try {
    const bundle = chains.get(fromRunId);
    if (!bundle) throw new Error(`no standing chain cached for run ${fromRunId}`);
    chains.set(newRunId, bundle); // re-votes can continue from the new run too
    store.patch(newRunId, { status: 'redelegated', redelegationHash: bundle.redelegationHash });
    await cast(store, newRunId, bundle, proposalId, proposalText, cfg);
  } catch (err) {
    store.patch(newRunId, {
      status: 'failed',
      error: { code: 'INTERNAL', message: err instanceof Error ? err.message : String(err) },
    });
  }
}
