/**
 * Pure tool logic for the Mandate governance MCP server. An AI agent can REQUEST a scoped,
 * revocable voting mandate (and read its exact terms), but it can never self-grant: the returned
 * delegation is UNSIGNED — only the human owner's MetaMask smart account can sign it. Reuses the
 * same ERC-7710 builder the app/CLI use, so the request the agent gets is byte-identical to a grant.
 */
import { buildStandingVoteDelegation, PROPOSALS, VOTE_BOARD_ADDRESS, type Delegation } from '@mandate/shared';
import { getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit';
import type { Address } from 'viem';

export const MANDATE_CHAIN_ID = 84532; // Base Sepolia

export interface MandateRequestArgs {
  /** the human owner's MetaMask smart account (the root delegator who must sign). */
  delegatorSmartAccount: Address;
  /** the agent smart account that will hold the root delegation. */
  orchestrator: Address;
  /** the VoteBoard / Governor the mandate is scoped to (defaults to the deployed board). */
  board?: Address;
  /** cap the mandate to ≤N votes (omit for no cap). */
  maxVotes?: number;
  /** expire the mandate after N days (omit for no expiry). */
  ttlDays?: number;
  /** current unix seconds (injected so the builder stays pure/testable). */
  nowSec: number;
}

export interface MandateScope {
  action: string;
  target: Address;
  cannot: string[];
  maxVotes: number | null;
  expiresAtUnix: number | null;
  revocable: true;
  enforcers: string[];
}

export interface MandateRequest {
  /** ready for the human owner to sign via `userSA.signDelegation` — has NO signature yet. */
  unsignedDelegation: Delegation;
  scope: MandateScope;
  chainId: number;
  activation: string;
}

/** Build the exact (unsigned) standing vote delegation an agent is asking the owner to grant. */
export function buildMandateRequest(a: MandateRequestArgs): MandateRequest {
  const board = a.board ?? (VOTE_BOARD_ADDRESS as Address);
  const environment = getSmartAccountsEnvironment(MANDATE_CHAIN_ID);
  // A mandate must ALWAYS be bounded — the SDK rejects an unrestricted delegation, and "bounded" is
  // the whole safety story. If the agent gives neither a vote cap nor a TTL, default to 30 days.
  const ttlDays = a.ttlDays ?? (a.maxVotes == null ? 30 : undefined);
  const expiry = ttlDays != null ? a.nowSec + ttlDays * 86_400 : undefined;

  const unsignedDelegation = buildStandingVoteDelegation({
    governor: board,
    delegate: a.orchestrator,
    delegator: a.delegatorSmartAccount,
    environment,
    maxVotes: a.maxVotes,
    expiry,
  });

  const enforcers = ['AllowedTargets', 'AllowedMethods'];
  if (a.maxVotes != null) enforcers.push('LimitedCalls');
  if (expiry != null) enforcers.push('Timestamp');

  return {
    unsignedDelegation,
    scope: {
      action: 'castVote(uint256,uint8) — vote only',
      target: board,
      cannot: [
        'move funds or transfer any token',
        'call any method other than castVote',
        'vote on any contract other than this board',
      ],
      maxVotes: a.maxVotes ?? null,
      expiresAtUnix: expiry ?? null,
      revocable: true,
      enforcers,
    },
    chainId: MANDATE_CHAIN_ID,
    activation:
      'This delegation is UNSIGNED. An AI agent cannot self-grant voting authority: the human owner ' +
      'must sign it with their MetaMask smart account (userSA.signDelegation) or via the Mandate app ' +
      'grant flow. Only then can the agent redeem the chain to cast votes — and the owner can ' +
      'disableDelegation to revoke the whole chain on-chain at any time.',
  };
}

/** Plain-English description of what a Mandate governance grant is + its on-chain guarantees. */
export function describeMandate() {
  return {
    summary: 'A scoped, revocable ERC-7710 governance voting mandate for an AI agent.',
    guarantees: [
      'Vote-only: the agent can ONLY call castVote on the named DAO board (AllowedMethods + AllowedTargets enforcers) — it can never move funds.',
      'Bounded: optionally capped to ≤N votes (LimitedCalls) and/or an expiry (Timestamp).',
      'Revocable: the owner disables the root delegation on-chain at any time; every redemption then reverts.',
      'Custody-preserving: enforced by the EVM DelegationManager — the agent cannot override the caveats.',
      'Human-in-the-loop: an agent can REQUEST a mandate (build_mandate_request), but only the human owner can sign it.',
    ],
    chainId: MANDATE_CHAIN_ID,
    board: VOTE_BOARD_ADDRESS,
  };
}

/** The DAO proposals an agent could be mandated to vote on. */
export function listProposals() {
  return PROPOSALS.map((p) => ({
    id: p.id.toString(),
    title: p.title.en,
    titleZh: p.title.zh,
    body: p.body.en,
  }));
}
