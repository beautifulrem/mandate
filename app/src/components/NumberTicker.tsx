'use client';

import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect } from 'react';

/**
 * Animated count that springs from its previous value to the new one — used for
 * the agent-authority meter (100% → 0% the instant the chain is severed).
 * Respects prefers-reduced-motion by snapping instantly.
 */
export function NumberTicker({ value, suffix = '', duration = 0.9 }: { value: number; suffix?: string; duration?: number }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, duration, mv]);

  return <motion.span>{text}</motion.span>;
}
