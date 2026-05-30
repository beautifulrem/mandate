/**
 * Demo-clock helpers for the Governor's short Active window (votingPeriod=300s).
 * The pure timing logic is unit-tested; the viem read/reseed helpers run against a
 * live Governor (verified end-to-end, not unit-tested with a mock chain).
 */
import {
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';

/** OpenZeppelin Governor ProposalState. */
export enum ProposalState {
  Pending = 0,
  Active = 1,
  Canceled = 2,
  Defeated = 3,
  Succeeded = 4,
  Queued = 5,
  Expired = 6,
  Executed = 7,
}

export type ProposalPhase = 'pending' | 'active' | 'closed';

export interface ProposalWindow {
  phase: ProposalPhase;
  /** seconds until the Active window opens (0 once active/closed) */
  secondsUntilActive: number;
  /** seconds left in the Active window (0 unless active) */
  secondsRemaining: number;
}

/**
 * Pure: classify a proposal's timing on a timestamp clock.
 * Active iff snapshot < now <= deadline (matches OZ Governor._state).
 */
export function proposalWindow(
  nowSec: number,
  snapshotSec: number,
  deadlineSec: number,
): ProposalWindow {
  if (nowSec <= snapshotSec) {
    return { phase: 'pending', secondsUntilActive: snapshotSec - nowSec + 1, secondsRemaining: 0 };
  }
  if (nowSec <= deadlineSec) {
    return { phase: 'active', secondsUntilActive: 0, secondsRemaining: deadlineSec - nowSec };
  }
  return { phase: 'closed', secondsUntilActive: 0, secondsRemaining: 0 };
}

/** Throws unless the proposal is Active with at least `minRemainingSec` left. */
export function assertUsableWindow(window: ProposalWindow, minRemainingSec: number): void {
  if (window.phase !== 'active') {
    throw new Error(`proposal not active (phase=${window.phase}); reseed before the demo`);
  }
  if (window.secondsRemaining < minRemainingSec) {
    throw new Error(
      `only ${window.secondsRemaining}s left in the voting window (need >= ${minRemainingSec}s); reseed`,
    );
  }
}

/** Minimal Governor ABI for the demo-clock + reseed helpers. */
export const GOVERNOR_ABI = [
  { type: 'function', name: 'state', stateMutability: 'view', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'proposalSnapshot', stateMutability: 'view', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'proposalDeadline', stateMutability: 'view', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'votingDelay', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'votingPeriod', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function', name: 'hashProposal', stateMutability: 'pure',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'calldatas', type: 'bytes[]' },
      { name: 'descriptionHash', type: 'bytes32' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'propose', stateMutability: 'nonpayable',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'calldatas', type: 'bytes[]' },
      { name: 'description', type: 'string' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

/** The benign, never-executed action used for demo proposals (a view call on the token). */
export function demoProposalAction(token: Address): {
  targets: readonly Address[];
  values: readonly bigint[];
  calldatas: readonly Hex[];
} {
  return { targets: [token], values: [0n], calldatas: ['0x18160ddd' as Hex] }; // totalSupply()
}

/** Read a live proposal's timing window. */
export async function fetchProposalWindow(
  client: PublicClient,
  governor: Address,
  proposalId: bigint,
): Promise<{ window: ProposalWindow; state: ProposalState; snapshot: bigint; deadline: bigint }> {
  const [stateRaw, snapshot, deadline, block] = await Promise.all([
    client.readContract({ address: governor, abi: GOVERNOR_ABI, functionName: 'state', args: [proposalId] }),
    client.readContract({ address: governor, abi: GOVERNOR_ABI, functionName: 'proposalSnapshot', args: [proposalId] }),
    client.readContract({ address: governor, abi: GOVERNOR_ABI, functionName: 'proposalDeadline', args: [proposalId] }),
    client.getBlock(),
  ]);
  const now = Number(block.timestamp);
  return {
    window: proposalWindow(now, Number(snapshot), Number(deadline)),
    state: Number(stateRaw) as ProposalState,
    snapshot,
    deadline,
  };
}

/** Create a fresh demo proposal (a new description yields a new id). Signs with the deployer. */
export async function reseedProposal(
  wallet: WalletClient,
  account: Account,
  governor: Address,
  token: Address,
  description: string,
): Promise<Hex> {
  const { targets, values, calldatas } = demoProposalAction(token);
  return wallet.writeContract({
    account,
    chain: wallet.chain,
    address: governor,
    abi: GOVERNOR_ABI,
    functionName: 'propose',
    args: [targets as Address[], values as bigint[], calldatas as Hex[], description],
  });
}
