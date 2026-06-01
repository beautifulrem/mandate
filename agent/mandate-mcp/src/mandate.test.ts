import { describe, expect, it } from 'vitest';
import { VOTE_BOARD_ADDRESS } from '@mandate/shared';
import { buildMandateRequest, describeMandate, listProposals } from './mandate.js';

const OWNER = '0x9858EF73c0886f21F26D3f95B7056a9F90b3F1e2' as const;
const ORCH = '0x2caaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaad16e' as const;
const NOW = 1_900_000_000;

describe('buildMandateRequest', () => {
  it('builds an UNSIGNED standing vote delegation from owner → orchestrator on the board', () => {
    const r = buildMandateRequest({ delegatorSmartAccount: OWNER, orchestrator: ORCH, maxVotes: 10, ttlDays: 30, nowSec: NOW });
    expect(r.unsignedDelegation.delegator.toLowerCase()).toBe(OWNER.toLowerCase());
    expect(r.unsignedDelegation.delegate.toLowerCase()).toBe(ORCH.toLowerCase());
    // no real signature yet — the human must sign it (createDelegation leaves it empty/0x)
    expect(r.unsignedDelegation.signature ?? '0x').toMatch(/^0x0*$/i);
    expect(r.scope.target.toLowerCase()).toBe(VOTE_BOARD_ADDRESS.toLowerCase());
  });

  it('reflects the vote-only, bounded, revocable scope + the matching enforcers', () => {
    const r = buildMandateRequest({ delegatorSmartAccount: OWNER, orchestrator: ORCH, maxVotes: 10, ttlDays: 30, nowSec: NOW });
    expect(r.scope.revocable).toBe(true);
    expect(r.scope.maxVotes).toBe(10);
    expect(r.scope.expiresAtUnix).toBe(NOW + 30 * 86_400);
    expect(r.scope.enforcers).toEqual(['AllowedTargets', 'AllowedMethods', 'LimitedCalls', 'Timestamp']);
    expect(r.scope.cannot.join(' ')).toMatch(/funds|transfer/i);
  });

  it('votes-only grant has no Timestamp enforcer / no expiry', () => {
    const r = buildMandateRequest({ delegatorSmartAccount: OWNER, orchestrator: ORCH, maxVotes: 5, nowSec: NOW });
    expect(r.scope.expiresAtUnix).toBeNull();
    expect(r.scope.enforcers).not.toContain('Timestamp');
    expect(r.scope.enforcers).toContain('LimitedCalls');
  });

  it('time-only grant has no LimitedCalls enforcer / no vote cap', () => {
    const r = buildMandateRequest({ delegatorSmartAccount: OWNER, orchestrator: ORCH, ttlDays: 30, nowSec: NOW });
    expect(r.scope.maxVotes).toBeNull();
    expect(r.scope.enforcers).not.toContain('LimitedCalls');
    expect(r.scope.enforcers).toContain('Timestamp');
  });

  it('always flags that the delegation must be human-signed (no self-grant)', () => {
    const r = buildMandateRequest({ delegatorSmartAccount: OWNER, orchestrator: ORCH, nowSec: NOW });
    expect(r.activation).toMatch(/UNSIGNED/);
    expect(r.activation).toMatch(/cannot self-grant|owner must sign/i);
  });
});

describe('describeMandate / listProposals', () => {
  it('describes the four on-chain guarantees', () => {
    const d = describeMandate();
    expect(d.guarantees.join(' ')).toMatch(/Vote-only/);
    expect(d.guarantees.join(' ')).toMatch(/Revocable/);
    expect(d.chainId).toBe(84532);
  });

  it('lists the DAO proposals an agent could be mandated on', () => {
    const ps = listProposals();
    expect(ps.length).toBeGreaterThan(0);
    expect(ps[0]).toHaveProperty('id');
    expect(ps[0]).toHaveProperty('title');
  });
});
