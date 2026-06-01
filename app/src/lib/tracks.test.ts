import { describe, expect, it } from 'vitest';
import { TRACK_DEFS, trackStateFor, type TrackSnapshot } from './tracks';

const BASE: TrackSnapshot = {
  isConnected: false,
  hasSA: false,
  hasRootDel: false,
  s: undefined,
  hasVenice: false,
  hasConfig: false,
};

describe('track checklist mapping', () => {
  it('covers exactly the six hackathon tracks in demo order', () => {
    expect(TRACK_DEFS.map((d) => d.short)).toEqual(['4337', '7710', 'A2A', 'TEE', 'x402', '1Shot']);
  });

  it('4337 — dormant → live on connect → proven once the smart account is derived', () => {
    expect(trackStateFor('4337', BASE)).toBe('dormant');
    expect(trackStateFor('4337', { ...BASE, isConnected: true })).toBe('live');
    expect(trackStateFor('4337', { ...BASE, isConnected: true, hasSA: true })).toBe('proven');
  });

  it('7710 — live while granting → proven once the root delegation is decodable', () => {
    expect(trackStateFor('7710', BASE)).toBe('dormant');
    expect(trackStateFor('7710', { ...BASE, s: 'granted' })).toBe('live');
    expect(trackStateFor('7710', { ...BASE, s: 'granted', hasRootDel: true })).toBe('proven');
  });

  it('A2A — live exactly at the redelegation hop, proven once past it', () => {
    expect(trackStateFor('A2A', { ...BASE, s: 'granted' })).toBe('dormant');
    expect(trackStateFor('A2A', { ...BASE, s: 'redelegated' })).toBe('live');
    expect(trackStateFor('A2A', { ...BASE, s: 'voting' })).toBe('proven');
  });

  it('TEE — live while analyzing → proven once a Venice attestation exists', () => {
    expect(trackStateFor('TEE', { ...BASE, s: 'analyzing' })).toBe('live');
    expect(trackStateFor('TEE', { ...BASE, s: 'decided', hasVenice: true })).toBe('proven');
    expect(trackStateFor('TEE', BASE)).toBe('dormant');
  });

  it('x402 — ready as an always-available toll demo once config loads', () => {
    expect(trackStateFor('x402', BASE)).toBe('dormant');
    expect(trackStateFor('x402', { ...BASE, hasConfig: true })).toBe('ready');
  });

  it('1Shot — always ready (the mainnet replay is available at any time)', () => {
    expect(trackStateFor('1Shot', BASE)).toBe('ready');
    expect(trackStateFor('1Shot', { ...BASE, isConnected: true, hasSA: true })).toBe('ready');
  });
});
