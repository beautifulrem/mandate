// Pure derivation of the standing mandate's live state — votes used/remaining, days left until the
// baked-in expiry, and whether the grant is still usable. Kept out of the component so the
// "how much authority is left" math is unit-testable (the bounds are enforced on-chain by the
// LimitedCalls + Timestamp caveats; this just mirrors them for the HUD).

export type BoundMode = 'votes' | 'days' | 'both';

export interface MandateInput {
  boundMode: BoundMode;
  maxVotes: number;
  ttlDays: number;
  votesUsed: number;
  /** ms timestamp when the grant was signed; null before any grant. */
  grantedAtMs: number | null;
  /** current time in ms (passed in to keep this pure/testable). */
  nowMs: number;
  killed: boolean;
}

export interface MandateStatus {
  votesUsed: number;
  /** null when the grant is bounded by time only (votes uncapped). */
  votesCap: number | null;
  votesRemaining: number | null;
  /** null when the grant is bounded by votes only (no expiry). */
  daysLeft: number | null;
  expired: boolean;
  exhausted: boolean;
  /** the grant is still usable (not killed, expired, or exhausted). */
  live: boolean;
  /** 100 while live, 0 once the agent's authority is gone. */
  authorityPct: number;
}

const DAY_MS = 86_400_000;

export function mandateStatus(i: MandateInput): MandateStatus {
  const votesCap = i.boundMode === 'days' ? null : i.maxVotes;
  const votesRemaining = votesCap == null ? null : Math.max(0, votesCap - i.votesUsed);
  const exhausted = votesCap != null && i.votesUsed >= votesCap;

  const expiryMs = i.boundMode === 'votes' || i.grantedAtMs == null ? null : i.grantedAtMs + i.ttlDays * DAY_MS;
  const expired = expiryMs != null && i.nowMs >= expiryMs;
  const daysLeft = expiryMs == null ? null : Math.max(0, Math.ceil((expiryMs - i.nowMs) / DAY_MS));

  const live = !i.killed && !expired && !exhausted;
  return {
    votesUsed: i.votesUsed,
    votesCap,
    votesRemaining,
    daysLeft,
    expired,
    exhausted,
    live,
    authorityPct: live ? 100 : 0,
  };
}
