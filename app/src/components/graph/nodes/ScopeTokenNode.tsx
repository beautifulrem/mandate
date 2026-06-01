'use client';

import type { NodeProps } from '@xyflow/react';
import { Lock } from 'lucide-react';
import { cn } from '../../../lib/cn';
import type { ScopeTokenGraphNode } from '../graphModel';

/**
 * The ERC-7710 caveat/scope token, floating above whichever hop holds the permission. It rides from
 * the orchestrator to the analyst and SHRINKS on redelegation — the visible A2A attenuation. A glowing
 * pill (not a card); frameless on the canvas.
 */
export function ScopeTokenNode({ data }: NodeProps<ScopeTokenGraphNode>) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-chip bg-gradient-to-br from-brand to-brand-soft px-2.5 py-1 text-[11px] font-bold text-[#1a0f02] shadow-[0_0_26px_-6px_var(--color-brand)] transition-all duration-500 ease-fluid',
        data.redelegated && 'scale-90',
        data.killed && 'opacity-40 grayscale',
      )}
    >
      <Lock className="size-3" strokeWidth={2.5} />
      {data.label}
    </div>
  );
}
