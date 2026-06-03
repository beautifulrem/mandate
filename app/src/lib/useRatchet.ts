'use client';

import { useEffect, useState } from 'react';

/**
 * Reveal pacing primitive: a displayed index that climbs toward `target` one step every `stepMs`,
 * never running ahead of it. When `target` drops below the current value (a fresh run / reset) it
 * snaps back; `snap=true` jumps straight to `target` (used on kill). Returns the displayed index.
 *
 * Lifted out so the cockpit can drive the authority chain AND the TEE console off ONE staged index
 * (keeping them in lockstep), and the chain can chain a second, faster ratchet for node lighting.
 */
export function useRatchet(target: number, stepMs: number, snap = false): number {
  const [v, setV] = useState(-1);
  useEffect(() => {
    if (snap) {
      if (v !== target) setV(target);
      return;
    }
    if (v === target) return;
    if (v > target) {
      setV(target); // target moved behind us (reset) — snap back, then re-climb
      return;
    }
    const id = setTimeout(() => setV((x) => x + 1), stepMs);
    return () => clearTimeout(id);
  }, [v, target, stepMs, snap]);
  return v;
}
