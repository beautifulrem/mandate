import { describe, expect, it } from 'vitest';
import { mandateStatus, type MandateInput } from './mandate';

const T0 = 1_900_000_000_000; // a fixed "grant" instant (ms)
const DAY = 86_400_000;

const base: MandateInput = {
  boundMode: 'both',
  maxVotes: 10,
  ttlDays: 30,
  votesUsed: 1,
  grantedAtMs: T0,
  nowMs: T0 + 5_000, // 5s after the grant
  killed: false,
};

describe('mandateStatus', () => {
  it('reports votes used/cap/remaining and a ~full validity window just after granting', () => {
    const s = mandateStatus(base);
    expect(s.votesCap).toBe(10);
    expect(s.votesRemaining).toBe(9);
    expect(s.daysLeft).toBe(30);
    expect(s.live).toBe(true);
    expect(s.authorityPct).toBe(100);
  });

  it('votes-only grant has no expiry (daysLeft null)', () => {
    const s = mandateStatus({ ...base, boundMode: 'votes' });
    expect(s.votesCap).toBe(10);
    expect(s.daysLeft).toBeNull();
  });

  it('time-only grant leaves votes uncapped (votesCap null)', () => {
    const s = mandateStatus({ ...base, boundMode: 'days', votesUsed: 3 });
    expect(s.votesCap).toBeNull();
    expect(s.votesRemaining).toBeNull();
    expect(s.exhausted).toBe(false);
    expect(s.daysLeft).toBe(30);
  });

  it('counts the validity window down as time passes', () => {
    const s = mandateStatus({ ...base, nowMs: T0 + 10 * DAY });
    expect(s.daysLeft).toBe(20);
  });

  it('goes dead (0% authority) once the vote cap is exhausted', () => {
    const s = mandateStatus({ ...base, votesUsed: 10 });
    expect(s.exhausted).toBe(true);
    expect(s.votesRemaining).toBe(0);
    expect(s.live).toBe(false);
    expect(s.authorityPct).toBe(0);
  });

  it('goes dead once the window expires (daysLeft 0)', () => {
    const s = mandateStatus({ ...base, nowMs: T0 + 31 * DAY });
    expect(s.expired).toBe(true);
    expect(s.daysLeft).toBe(0);
    expect(s.live).toBe(false);
    expect(s.authorityPct).toBe(0);
  });

  it('revoke kills authority immediately, regardless of remaining votes/time', () => {
    const s = mandateStatus({ ...base, killed: true });
    expect(s.live).toBe(false);
    expect(s.authorityPct).toBe(0);
    // the historical counts still read out for the dossier
    expect(s.votesRemaining).toBe(9);
    expect(s.daysLeft).toBe(30);
  });
});
