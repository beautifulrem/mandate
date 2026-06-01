'use client';

import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { Scissors } from 'lucide-react';
import { cn } from '../../../lib/cn';
import type { AuthorityGraphEdge } from '../graphModel';

/**
 * A glowing authority beam between two actor nodes: a faint base wire so the topology always reads,
 * plus a brand-gradient glow overlay that FLOWS (animated dash) while the hop is live and settles
 * (steady glow) once passed. On revoke it becomes a red dashed break with a Scissors glyph.
 */
export function AuthorityEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<AuthorityGraphEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.3,
  });
  const live = !!data?.live;
  const settled = !!data?.settled;
  const killed = !!data?.killed;
  const gradId = `auth-grad-${id}`;

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0" x2="100%" y2="0">
          <stop offset="0%" stopColor="var(--color-brand-deep)" />
          <stop offset="55%" stopColor="var(--color-brand)" />
          <stop offset="100%" stopColor="var(--color-brand-soft)" />
        </linearGradient>
      </defs>

      {/* always-drawn base wire so the chain topology reads at every state */}
      <path
        d={path}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        className={cn('transition-[stroke,opacity] duration-300', killed ? 'opacity-70 [stroke-dasharray:5_7]' : '')}
        style={{ stroke: killed ? 'var(--color-bad)' : 'var(--color-line)' }}
      />

      {/* glowing flow overlay while live / settled */}
      {!killed && (live || settled) && (
        <path
          d={path}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={live ? 3 : 2.5}
          strokeLinecap="round"
          className={cn(live && 'graph-edge-flow')}
          style={{ filter: 'drop-shadow(0 0 5px var(--color-brand))', opacity: settled && !live ? 0.85 : 1 }}
        />
      )}

      {/* the sever cut */}
      {killed && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="grid size-6 place-items-center rounded-full bg-base/80 text-bad shadow-[0_0_16px_-4px_var(--color-bad)]"
          >
            <Scissors className="size-3.5" strokeWidth={2.5} />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
