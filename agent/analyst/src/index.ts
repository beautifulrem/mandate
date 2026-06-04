/**
 * @mandate/analyst — the CASTER agent. The orchestrator (coordinator) decides the support by
 * fanning the proposal out to the four governance lenses and synthesizing their verdicts; the
 * analyst is the on-chain executor: it redeems the (per-proposal-narrowed) delegation chain it is
 * handed to cast that support AS the user. It pre-flights the redeem so a chain an enforcer would
 * reject fails cleanly instead of broadcasting a reverting transaction.
 */
import type { Account, Address, PublicClient, WalletClient } from 'viem';
import { canRedeem, redeemVoteCalldata, type Delegation, type Support, type VoteReceipt } from '@mandate/shared';

export interface CasterDeps {
  publicClient: PublicClient;
  analystWallet: WalletClient;
  analystAccount: Account;
  delegationManager: Address;
}

export interface CastRequest {
  /** the signed delegation chain, leaf→root (analyst is the leaf). */
  chain: Delegation[];
  governor: Address;
  proposalId: bigint;
  /** the synthesized support the orchestrator decided (0=Against 1=For 2=Abstain). */
  support: Support;
}

/**
 * Redeem the chain to cast `support`. A canRedeem simulation runs first: if an enforcer would reject
 * the chain (e.g. the per-proposal AllowedCalldata lock, an exhausted LimitedCalls, an expired
 * Timestamp, or a disabled root), it throws instead of broadcasting a tx that reverts on-chain.
 */
export async function castVote(deps: CasterDeps, req: CastRequest): Promise<VoteReceipt> {
  const redeemData = redeemVoteCalldata({
    chain: req.chain,
    governor: req.governor,
    proposalId: req.proposalId,
    support: req.support,
  });
  const ok = await canRedeem(deps.publicClient, deps.delegationManager, redeemData, deps.analystAccount.address);
  if (!ok) throw new Error('redeem would revert (pre-flight) — the narrowed chain was rejected by an enforcer');

  const txHash = await deps.analystWallet.sendTransaction({
    account: deps.analystAccount,
    chain: deps.analystWallet.chain,
    to: deps.delegationManager,
    data: redeemData,
  });
  const receipt = await deps.publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') throw new Error(`analyst vote tx reverted: ${txHash}`);

  return {
    txHash,
    support: req.support,
    blockNumber: receipt.blockNumber.toString(),
    relay: 'direct',
  };
}
