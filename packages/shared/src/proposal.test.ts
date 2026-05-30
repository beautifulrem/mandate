import { describe, expect, it } from 'vitest';
import { assertUsableWindow, proposalWindow } from './proposal.js';

// snapshot at 160s, deadline at 460s (a 300s voting window) on a timestamp clock.
const SNAP = 160;
const DEAD = 460;

describe('proposalWindow', () => {
  it('is pending before (and at) the snapshot, counting down to Active', () => {
    expect(proposalWindow(100, SNAP, DEAD)).toEqual({
      phase: 'pending',
      secondsUntilActive: 61, // becomes active once now > snapshot
      secondsRemaining: 0,
    });
    // at exactly the snapshot it is still pending (OZ: active iff now > snapshot)
    expect(proposalWindow(SNAP, SNAP, DEAD).phase).toBe('pending');
  });

  it('is active inside the window, with the seconds left', () => {
    expect(proposalWindow(200, SNAP, DEAD)).toEqual({
      phase: 'active',
      secondsUntilActive: 0,
      secondsRemaining: 260,
    });
    // active through the deadline inclusive
    expect(proposalWindow(DEAD, SNAP, DEAD)).toEqual({
      phase: 'active',
      secondsUntilActive: 0,
      secondsRemaining: 0,
    });
  });

  it('is closed once past the deadline', () => {
    expect(proposalWindow(DEAD + 1, SNAP, DEAD)).toEqual({
      phase: 'closed',
      secondsUntilActive: 0,
      secondsRemaining: 0,
    });
  });
});

describe('assertUsableWindow', () => {
  it('passes when active with enough time left', () => {
    expect(() => assertUsableWindow(proposalWindow(200, SNAP, DEAD), 60)).not.toThrow();
  });

  it('throws when the proposal is not active', () => {
    expect(() => assertUsableWindow(proposalWindow(100, SNAP, DEAD), 60)).toThrow(/not active/);
    expect(() => assertUsableWindow(proposalWindow(DEAD + 5, SNAP, DEAD), 60)).toThrow(/not active/);
  });

  it('throws when too little time remains', () => {
    // 30s left, need 60
    expect(() => assertUsableWindow(proposalWindow(DEAD - 30, SNAP, DEAD), 60)).toThrow(/need >= 60s/);
  });
});
