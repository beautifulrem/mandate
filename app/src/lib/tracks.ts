// The judges' track checklist — pure mapping from a run snapshot to each hackathon track's state.
// Kept out of the component so the "which capability is live/proven now" logic is unit-testable.

import { reached } from './runState';

export type TrackState = 'dormant' | 'ready' | 'live' | 'proven';
export type TrackTone = 'brand' | 'info' | 'ok' | 'eth';

/** The minimal run snapshot each track reads to decide its state. */
export interface TrackSnapshot {
  isConnected: boolean;
  hasSA: boolean;
  hasRootDel: boolean;
  s?: string;
  hasVenice: boolean;
  hasConfig: boolean;
}

export interface TrackDef {
  /** Short chip label shown in the rail. */
  short: string;
  /** Index into t.scorecard.items for the full name + proof copy. */
  itemIndex: number;
  tone: TrackTone;
  state: (snap: TrackSnapshot) => TrackState;
}

/**
 * The six tracks, in demo order. States:
 *  - dormant: not yet reached (dim)
 *  - ready:   an always-available capability the judge can trigger now (x402 toll, 1Shot replay)
 *  - live:    its moment is happening right now (pulsing)
 *  - proven:  its on-chain/decoded artifact exists (✓)
 */
export const TRACK_DEFS: TrackDef[] = [
  { short: '4337', itemIndex: 0, tone: 'brand', state: (s) => (s.hasSA ? 'proven' : s.isConnected ? 'live' : 'dormant') },
  { short: '7710', itemIndex: 1, tone: 'brand', state: (s) => (s.hasRootDel ? 'proven' : s.s === 'granted' ? 'live' : 'dormant') },
  {
    short: 'A2A',
    itemIndex: 2,
    tone: 'info',
    state: (s) => (s.s === 'redelegated' ? 'live' : reached(s.s, 'redelegated') ? 'proven' : 'dormant'),
  },
  { short: 'TEE', itemIndex: 3, tone: 'info', state: (s) => (s.hasVenice ? 'proven' : s.s === 'analyzing' ? 'live' : 'dormant') },
  { short: 'x402', itemIndex: 4, tone: 'ok', state: (s) => (s.hasConfig ? 'ready' : 'dormant') },
  { short: '1Shot', itemIndex: 5, tone: 'eth', state: () => 'ready' },
];

/** Convenience: resolve a single track's state by its short label (used by tests). */
export function trackStateFor(short: string, snap: TrackSnapshot): TrackState | undefined {
  return TRACK_DEFS.find((d) => d.short === short)?.state(snap);
}
