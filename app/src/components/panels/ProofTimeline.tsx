'use client';

import type { ReactNode } from 'react';
import type { RunStatus } from '@mandate/shared';
import { Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import { BASESCAN, shortHex } from '../../lib/config';
import { cn } from '../../lib/cn';
import { decisionTone, reached, statusTone } from '../../lib/runState';
import type { Dict } from '../../lib/i18n';
import { PanelHeader } from '../ui/Panel';
import { Badge } from '../ui/Badge';

type StepRow = { done: boolean; label: string; node: ReactNode; fail?: boolean };

/**
 * "Under the hood" run proof (frameless): the four-step timeline (granted → narrowed → decided in
 * TEE → cast), the root/redelegation hashes, and — once a run carries an error — either the honest
 * "revoke worked" note (when killed) or the raw failure line.
 */
export function ProofTimeline({ run, killed, t }: { run: RunStatus; killed: boolean; t: Dict }) {
  const s = run.status;
  const venice = run.venice;
  const terminal = ['voted', 'failed', 'revoked'].includes(s);
  const statusKey = killed ? 'revoked' : s;

  const steps: StepRow[] = [
    { done: reached(s, 'granted'), label: t.steps[0], node: null },
    { done: reached(s, 'redelegated'), label: t.steps[1], node: null },
    {
      done: reached(s, 'decided'),
      label: t.steps[2],
      node: venice ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={decisionTone(venice.decision)}>{venice.decision}</Badge>
          {venice.attestation.verified && <Badge tone="ok">{t.teeAttested}</Badge>}
          <span className="font-mono text-[11px] text-ink-mute">{venice.model}</span>
          <span className="w-full text-[13px] italic text-ink-soft">“{venice.rationale}”</span>
        </div>
      ) : null,
    },
    {
      done: reached(s, 'voted'),
      fail: s === 'failed',
      label: killed && s === 'failed' ? t.voteRejected : t.steps[3],
      node: run.vote ? (
        <a
          className="mt-2 inline-block font-mono text-[13px] text-info hover:underline"
          href={`${BASESCAN}/tx/${run.vote.txHash}`}
          target="_blank"
          rel="noreferrer"
        >
          {t.castVoteTx} {shortHex(run.vote.txHash, 5)} ↗
        </a>
      ) : null,
    },
  ];
  const currentIdx = !killed && !terminal ? steps.findIndex((st) => !st.done) : -1;

  return (
    <div className="relative">
      <PanelHeader
        icon={Activity}
        title={
          <span className="flex items-center gap-2">
            {t.underHood} <span className="font-mono text-xs text-ink-mute">{shortHex(run.runId, 6)}</span>
          </span>
        }
        right={<Badge tone={statusTone(statusKey)}>{t.status[statusKey as keyof typeof t.status] ?? statusKey}</Badge>}
      />
      <div className="mt-1">
        {steps.map((st, i) => (
          <Step key={i} done={st.done} current={i === currentIdx} fail={st.fail} last={i === steps.length - 1} label={st.label}>
            {st.node}
          </Step>
        ))}
      </div>
      <div className="mt-3 grid gap-2 rounded-xl border border-hairline bg-surface-2/60 px-4 py-3">
        <div className="flex justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">{t.rootHash}</span>
          <span className="font-mono text-xs text-ink-soft">{shortHex(run.delegations.rootHash, 6)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">{t.redelegationHash}</span>
          <span className="font-mono text-xs text-ink-soft">
            {run.delegations.redelegationHash ? shortHex(run.delegations.redelegationHash, 6) : '—'}
          </span>
        </div>
      </div>
      {run.error &&
        (killed ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-ok/25 bg-ok/8 px-3 py-2 text-[13px] text-ink-soft">
            <ShieldCheck className="size-4 shrink-0 text-ok" /> {t.revokedRejected}
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 text-[13px] text-bad">
            <AlertTriangle className="size-4 shrink-0" /> {run.error.message.split('\n')[0]}
          </div>
        ))}
    </div>
  );
}

function Step({
  done,
  current,
  fail,
  last,
  label,
  children,
}: {
  done?: boolean;
  current?: boolean;
  fail?: boolean;
  last?: boolean;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-none flex-col items-center">
        <span
          className={cn(
            'mt-1.5 size-2.5 flex-none rounded-full transition-colors',
            fail ? 'bg-bad' : done ? 'bg-ok' : current ? 'bg-brand motion-safe:animate-glow' : 'bg-line',
          )}
        />
        {!last && <span className="mt-1 w-px flex-1 bg-hairline" />}
      </div>
      <div className="pb-3">
        <div className={cn('text-[13.5px]', done || current ? 'text-ink' : 'text-ink-mute')}>{label}</div>
        {children}
      </div>
    </div>
  );
}
