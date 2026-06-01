'use client';

import type { ReactNode } from 'react';
import { mandateStatus, type BoundMode } from '../../lib/mandate';
import { cn } from '../../lib/cn';
import { NumberTicker } from '../NumberTicker';
import type { Dict } from '../../lib/i18n';

const TONE = { brand: 'text-brand', bad: 'text-bad', ink: 'text-ink' } as const;

/**
 * The standing mandate's live state as big, frameless stat numbers — Vote budget (used / cap),
 * Valid-for (days left until the baked-in expiry), and Authority (100% live → 0% the instant it is
 * revoked / exhausted / expired). Replaces the buried one-line hint with a glanceable readout.
 */
export function MandateStats({
  boundMode,
  maxVotes,
  ttlDays,
  votesUsed,
  grantedAt,
  killed,
  t,
}: {
  boundMode: BoundMode;
  maxVotes: number;
  ttlDays: number;
  votesUsed: number;
  grantedAt: number | null;
  killed: boolean;
  t: Dict;
}) {
  const s = mandateStatus({
    boundMode,
    maxVotes,
    ttlDays,
    votesUsed,
    grantedAtMs: grantedAt,
    nowMs: Date.now(),
    killed,
  });

  return (
    <div className="flex items-end justify-center gap-6">
      <Stat label={t.mandateStats.votes} tone={s.exhausted ? 'bad' : 'brand'}>
        <NumberTicker value={s.votesUsed} />
        <span className="ml-0.5 text-base font-semibold text-ink-mute">
          {s.votesCap == null ? '/∞' : `/${s.votesCap}`}
        </span>
      </Stat>

      <Divider />

      <Stat label={t.mandateStats.validity} tone={s.expired ? 'bad' : 'ink'}>
        {s.daysLeft == null ? (
          <span>∞</span>
        ) : (
          <>
            <NumberTicker value={s.daysLeft} />
            <span className="ml-0.5 text-base font-semibold text-ink-mute">d</span>
          </>
        )}
      </Stat>

      <Divider />

      <Stat label={t.mandateStats.authority} tone={s.live ? 'brand' : 'bad'}>
        <NumberTicker value={s.authorityPct} />
        <span className="text-base font-semibold text-ink-mute">%</span>
      </Stat>
    </div>
  );
}

function Stat({ label, tone, children }: { label: string; tone: keyof typeof TONE; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn('flex items-baseline font-mono text-[26px] font-bold leading-none tabular-nums', TONE[tone])}>
        {children}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute/70">{label}</div>
    </div>
  );
}

function Divider() {
  return <span className="mb-2 h-8 w-px self-center bg-hairline" aria-hidden />;
}
