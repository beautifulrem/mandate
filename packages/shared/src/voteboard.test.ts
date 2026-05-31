import { describe, it, expect } from 'vitest';
import {
  DEMO_PERSONAS,
  DEMO_PROPOSAL_ID,
  decodeBallot,
  isVoteBoardLive,
  personaFor,
} from './voteboard.js';

describe('DEMO_PERSONAS', () => {
  it('has 5 personas seeded 3 For / 1 Against / 1 Abstain', () => {
    expect(DEMO_PERSONAS).toHaveLength(5);
    const counts = { 0: 0, 1: 0, 2: 0 } as Record<number, number>;
    for (const p of DEMO_PERSONAS) counts[p.support]++;
    expect(counts).toEqual({ 0: 1, 1: 3, 2: 1 });
  });
});

describe('personaFor', () => {
  it('maps a seeded address (case-insensitively) to its persona', () => {
    expect(personaFor(DEMO_PERSONAS[0].address)?.name).toBe('Alice');
    expect(personaFor(DEMO_PERSONAS[0].address.toLowerCase())?.name).toBe('Alice');
  });
  it('returns undefined for an unknown voter', () => {
    expect(personaFor('0x000000000000000000000000000000000000dEaD')).toBeUndefined();
  });
});

describe('isVoteBoardLive', () => {
  it('is false for the zero-address placeholder', () => {
    expect(isVoteBoardLive('0x0000000000000000000000000000000000000000')).toBe(false);
  });
  it('is true for a real deployed address', () => {
    expect(isVoteBoardLive('0x1e7868c6c3d0E441ACC28ee04a021a17438f364e')).toBe(true);
  });
});

describe('decodeBallot', () => {
  it('decodes support+1 storage to Support, null for not-voted', () => {
    expect(decodeBallot(0)).toBeNull();
    expect(decodeBallot(1)).toBe(0); // Against
    expect(decodeBallot(2)).toBe(1); // For
    expect(decodeBallot(3)).toBe(2); // Abstain
    expect(decodeBallot(4)).toBeNull();
  });
});

describe('DEMO_PROPOSAL_ID', () => {
  it('is a positive bigint', () => {
    expect(typeof DEMO_PROPOSAL_ID).toBe('bigint');
    expect(DEMO_PROPOSAL_ID > 0n).toBe(true);
  });
});
