'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * The visual content of a splitter: a thin grip line (brand-glows on hover/drag) + a circular
 * chevron that collapses / expands the sidebar. Render this as the CHILD of a <PanelResizeHandle>,
 * which MUST be a direct child of <PanelGroup> (react-resizable-panels detects handles by position).
 * The button stops pointer propagation so a click toggles instead of starting a drag.
 */
export function SplitterGrip({
  side,
  collapsed,
  onToggle,
}: {
  side: 'left' | 'right';
  collapsed: boolean;
  onToggle: () => void;
}) {
  // chevron points "outward" to collapse the sidebar, "inward" to expand it
  const pointLeft = side === 'left' ? !collapsed : collapsed;
  const Icon = pointLeft ? ChevronLeft : ChevronRight;

  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-hairline transition-colors duration-200 group-hover:bg-brand/50 group-data-[resize-handle-state=drag]:bg-brand" />
      <button
        type="button"
        aria-label={collapsed ? 'expand panel' : 'collapse panel'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        data-on={collapsed ? '' : undefined}
        className="absolute left-1/2 top-1/2 z-[6] grid! size-6! -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center! rounded-full! border! border-hairline! bg-surface! p-0! text-ink-mute! opacity-0 shadow-none! transition-all duration-200 hover:border-brand/45! hover:text-brand! group-hover:opacity-100 data-[on]:opacity-100"
      >
        <Icon className="size-3.5" strokeWidth={2.5} />
      </button>
    </>
  );
}
