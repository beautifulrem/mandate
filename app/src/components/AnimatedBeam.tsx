'use client';

import { useEffect, useId, useState, type RefObject } from 'react';
import { anchorPoint, buildBeamPath, type Point } from '../lib/beam';

interface AnimatedBeamProps {
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  /** Authority is flowing through this segment → animate the glowing pulse. */
  live?: boolean;
  /** Chain severed → red, broken, scissors. */
  killed?: boolean;
  curvature?: number;
}

/**
 * Draws a glowing "energy" beam from one node to the next (Magic-UI AnimatedBeam
 * pattern, reimplemented against our CSS tokens — no Tailwind). The flow + glow
 * are pure SVG/CSS so they never depend on a JS animation frame; geometry comes
 * from the unit-tested helpers in lib/beam.
 */
export function AnimatedBeam({ containerRef, fromRef, toRef, live, killed, curvature = 22 }: AnimatedBeamProps) {
  const id = useId().replace(/:/g, '');
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [d, setD] = useState('');
  const [mid, setMid] = useState<Point>({ x: 0, y: 0 });

  useEffect(() => {
    const compute = () => {
      const c = containerRef.current;
      const a = fromRef.current;
      const b = toRef.current;
      if (!c || !a || !b) return;
      const cr = c.getBoundingClientRect();
      const start = anchorPoint(cr, a.getBoundingClientRect(), 'right');
      const end = anchorPoint(cr, b.getBoundingClientRect(), 'left');
      setBox({ w: cr.width, h: cr.height });
      setD(buildBeamPath({ start, end, curvature }));
      setMid({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - curvature / 2 });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [containerRef, fromRef, toRef, curvature, live, killed]);

  if (!d) return null;

  return (
    <>
      <svg className="beam-svg" width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} fill="none" aria-hidden>
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-brand-accent)" />
            <stop offset="100%" stopColor="#ffc879" />
          </linearGradient>
          <filter id={`glow-${id}`} x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* static wire — always present so the topology reads even before flow */}
        <path className={`beam-base ${killed ? 'killed' : ''}`} d={d} />

        {/* glowing pulse — only while authority flows through this hop */}
        {live && !killed && (
          <path className="beam-pulse" d={d} stroke={`url(#g-${id})`} filter={`url(#glow-${id})`} />
        )}
      </svg>

      {killed && (
        <span className="beam-cut" style={{ left: mid.x, top: mid.y }} aria-hidden>
          ✂
        </span>
      )}
    </>
  );
}
