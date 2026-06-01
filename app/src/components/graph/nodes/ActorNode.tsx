'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Bot, Boxes, ExternalLink, ScanSearch, User, type LucideIcon } from 'lucide-react';
import { BASESCAN, shortHex } from '../../../lib/config';
import { cn } from '../../../lib/cn';
import { NumberTicker } from '../../NumberTicker';
import type { ActorGraphNode, ActorRole, GraphTone, TallyLabels } from '../graphModel';
import type { TallyBreakdown } from '../../../lib/voteboard-view';

const ICONS: Record<ActorRole, LucideIcon> = {
  you: User,
  orch: Bot,
  analyst: ScanSearch,
  voteBoard: Boxes,
};

const TONE_CLASSES: Record<GraphTone, { beacon: string; text: string; glow: string; pip: string }> = {
  brand: {
    beacon: 'text-brand ring-brand/70',
    text: 'text-brand',
    glow: 'shadow-[0_0_38px_-8px_var(--color-brand)]',
    pip: 'bg-brand shadow-[0_0_16px_-5px_var(--color-brand)]',
  },
  info: {
    beacon: 'text-info ring-info/70',
    text: 'text-info',
    glow: 'shadow-[0_0_38px_-8px_var(--color-info)]',
    pip: 'bg-info shadow-[0_0_16px_-5px_var(--color-info)]',
  },
  ok: {
    beacon: 'text-ok ring-ok/70',
    text: 'text-ok',
    glow: 'shadow-[0_0_38px_-8px_var(--color-ok)]',
    pip: 'bg-ok shadow-[0_0_16px_-5px_var(--color-ok)]',
  },
  warn: {
    beacon: 'text-warn ring-warn/70',
    text: 'text-warn',
    glow: 'shadow-[0_0_38px_-8px_var(--color-warn)]',
    pip: 'bg-warn shadow-[0_0_16px_-5px_var(--color-warn)]',
  },
  bad: {
    beacon: 'text-bad ring-bad/80',
    text: 'text-bad',
    glow: 'shadow-[0_0_38px_-8px_var(--color-bad)]',
    pip: 'bg-bad shadow-[0_0_16px_-5px_var(--color-bad)]',
  },
  mute: {
    beacon: 'text-ink-mute ring-hairline',
    text: 'text-ink-mute',
    glow: 'shadow-none',
    pip: 'bg-ink-mute',
  },
};

export function ActorNode({ data }: NodeProps<ActorGraphNode>) {
  const Icon = ICONS[data.role];
  const tone = TONE_CLASSES[data.tone];
  const active = !['dim', 'killed'].includes(data.state);
  const pulsing = data.state === 'working' || data.state === 'pending';

  return (
    <div
      className={cn(
        'relative flex w-[176px] flex-col items-center text-center transition-[opacity,filter,transform] duration-500 ease-fluid',
        data.state === 'dim' && 'opacity-40',
        data.killed && 'opacity-40 grayscale',
        data.state === 'failed' && 'graph-node-shake',
      )}
    >
      <Handle id="in" type="target" position={Position.Left} style={hiddenHandleStyle} />
      <Handle id="out" type="source" position={Position.Right} style={hiddenHandleStyle} />

      <div
        className={cn(
          'relative grid size-[70px] place-items-center rounded-full bg-surface/20 ring-1 backdrop-blur-sm transition-all duration-500 ease-fluid',
          tone.beacon,
          active ? tone.glow : 'shadow-none',
          pulsing && 'animate-glow',
          data.state === 'pending' && 'scale-105',
          data.state === 'failed' && 'ring-2',
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            'absolute inset-1 rounded-full opacity-50 blur-md transition-opacity',
            active ? tone.pip : 'bg-ink-mute opacity-20',
          )}
        />
        <span className="absolute inset-[13px] rounded-full bg-base/70" />
        <Icon className="relative size-7" strokeWidth={2} />
      </div>

      <div className="mt-3 min-h-[74px] text-center">
        <div className={cn('font-display text-[15px] font-semibold leading-tight text-ink', active && tone.text)}>
          {data.name}
        </div>
        <div className="mt-0.5 text-[11px] font-medium leading-tight text-ink-soft/80">{data.roleText}</div>
        <AddressLink addr={data.addr} />
        {data.tee && <Thinking label={data.thinkingLabel} />}
        {data.verdict && !data.tee && <div className={cn('mt-1 text-[11px] font-semibold', tone.text)}>{data.verdict}</div>}
        {data.role === 'voteBoard' && data.tally && data.tallyLabels && (
          <TallyPips tally={data.tally} labels={data.tallyLabels} killed={data.killed} />
        )}
      </div>
    </div>
  );
}

const hiddenHandleStyle: React.CSSProperties = {
  width: 1,
  height: 1,
  minWidth: 1,
  minHeight: 1,
  opacity: 0,
  border: 0,
  background: 'transparent',
  pointerEvents: 'none',
};

function AddressLink({ addr }: { addr?: string }) {
  if (!addr) {
    return <div className="mt-1 font-mono text-[11px] text-ink-mute">--</div>;
  }
  return (
    <a
      className="mt-1 inline-flex items-center justify-center gap-1 font-mono text-[11px] text-ink-mute transition-colors hover:text-info"
      href={`${BASESCAN}/address/${addr}`}
      target="_blank"
      rel="noreferrer"
    >
      <span>{shortHex(addr, 4)}</span>
      <ExternalLink className="size-3" strokeWidth={2} />
    </a>
  );
}

function Thinking({ label }: { label: string }) {
  return (
    <div className="mt-1 bg-[linear-gradient(90deg,var(--color-ink-mute),var(--color-brand-soft),var(--color-ink-mute))] bg-[length:220%_100%] bg-clip-text text-[11px] font-semibold text-transparent animate-shimmer">
      {label}
    </div>
  );
}

function TallyPips({ tally, labels, killed }: { tally: TallyBreakdown; labels: TallyLabels; killed: boolean }) {
  const items: Array<{ key: keyof TallyLabels; value: number; pct: number; tone: GraphTone }> = [
    { key: 'for', value: tally.for_, pct: tally.pct.for_, tone: 'ok' },
    { key: 'against', value: tally.against, pct: tally.pct.against, tone: 'bad' },
    { key: 'abstain', value: tally.abstain, pct: tally.pct.abstain, tone: 'mute' },
  ];

  return (
    <div className={cn('mt-2 flex items-center justify-center gap-2', killed && 'opacity-60')}>
      {items.map((item) => {
        const tone = TONE_CLASSES[item.tone];
        const scale = 0.76 + Math.max(0, item.pct) / 140;
        return (
          <span
            key={item.key}
            className="inline-flex items-center gap-1 font-mono text-[10px] text-ink-soft"
            title={`${labels[item.key]} ${item.value}`}
            aria-label={`${labels[item.key]} ${item.value}`}
          >
            <span
              className={cn('block size-2 rounded-full transition-transform duration-500 ease-fluid', tone.pip)}
              style={{ transform: `scale(${scale.toFixed(2)})` }}
            />
            <NumberTicker value={item.value} duration={0.55} />
          </span>
        );
      })}
    </div>
  );
}
