'use client';

import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { Address } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ShieldCheck } from 'lucide-react';
import type { DaoProposal, Delegation, RunStatus } from '@mandate/shared';
import type { DemoConfig } from '../lib/orchestrator';
import type { SmartAccount } from '../lib/wallet';
import type { Dict, Lang } from '../lib/i18n';
import { cn } from '../lib/cn';
import { LangToggle } from './LangToggle';
import { StatusDot } from './ui/Badge';

/**
 * The view-model the orchestrator (page.tsx) hands to the single-screen cockpit. It carries the
 * full run state, derived flags, grant-config, refs, and action callbacks — every region reads
 * from this so page.tsx stays a thin orchestrator and all business logic lives in one place.
 */
export interface MissionVM {
  // i18n
  lang: Lang;
  t: Dict;
  toggleLang: () => void;
  // config + proposal
  cfg: DemoConfig | null;
  activeIdx: number;
  setActiveIdx: (i: number) => void;
  activeProposal: DaoProposal;
  proposalCount: number;
  // wallet
  address?: Address;
  isConnected: boolean;
  userSA: SmartAccount | null;
  // run
  run: RunStatus | null;
  s?: string;
  venice: RunStatus['venice'];
  rootDel: Delegation | null;
  grantedProposalId: bigint | null;
  grantRunId: string | null;
  votesUsed: number;
  youAddr?: string;
  orchAddr?: string;
  analystAddr?: string;
  killed: boolean;
  terminal: boolean;
  running: boolean;
  statusKey: string;
  authorityPct: number;
  // grant config
  maxVotes: number;
  setMaxVotes: (n: number) => void;
  ttlDays: number;
  setTtlDays: (n: number) => void;
  boundMode: 'votes' | 'days' | 'both';
  setBoundMode: (m: 'votes' | 'days' | 'both') => void;
  // status flags
  busy: boolean;
  recalling: boolean;
  recallTx: string | null;
  error: string | null;
  // refs (fireSever origin = the graph stage)
  graphStageRef: RefObject<HTMLDivElement | null>;
  // actions
  onGrant: () => void;
  onVoteActive: () => void;
  onRecall: () => void;
}

/** Cockpit grid (desktop ≥1024px). Responsive fallback lands in MC-S9. */
const COCKPIT: CSSProperties = {
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: 'minmax(280px,320px) minmax(0,1fr) minmax(300px,360px)',
  gridTemplateRows: 'auto auto minmax(0,1fr) auto auto',
  gridTemplateAreas: [
    '"topbar    topbar   topbar"',
    '"leftrail  dock     dossier"',
    '"leftrail  stage    dossier"',
    '"leftrail  actions  dossier"',
    '"trackrail trackrail trackrail"',
  ].join('\n'),
};

/** Labeled placeholder for a region not yet built (removed slice-by-slice). */
function Region({ area, label, hint, children }: { area: string; label: string; hint?: string; children?: ReactNode }) {
  return (
    <section
      style={{ gridArea: area }}
      className="min-h-0 rounded-panel border border-dashed border-hairline bg-surface/40 p-4 backdrop-blur"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-mute">{label}</div>
      {hint && <div className="mt-1 text-[13px] text-ink-soft">{hint}</div>}
      {children}
    </section>
  );
}

export function MissionControl({ vm }: { vm: MissionVM }) {
  const { t } = vm;
  return (
    <div style={COCKPIT} className="mx-auto min-h-dvh w-full max-w-[1600px] px-4 py-4 sm:px-6">
      {/* TopBar — real */}
      <header style={{ gridArea: 'topbar' }} className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl border border-brand/30 bg-brand/10 text-brand shadow-[0_0_24px_-8px_var(--color-brand)]">
            <ShieldCheck className="size-5" strokeWidth={2} />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-ink">Mandate</span>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle lang={vm.lang} onToggle={vm.toggleLang} />
          <span className="inline-flex items-center gap-2 rounded-chip border border-hairline bg-surface/60 px-3 py-1.5 text-xs font-semibold text-ink-soft backdrop-blur">
            <StatusDot tone="ok" /> Base Sepolia
          </span>
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
        </div>
      </header>

      <Region area="dock" label="Proposal Dock" hint={vm.activeProposal.title[vm.lang]}>
        <div className="mt-1 text-[11px] text-ink-mute">
          {vm.activeIdx + 1}/{vm.proposalCount} · #{vm.activeProposal.id.toString().slice(-6)}
        </div>
      </Region>

      <Region area="stage" label="Graph Stage · React Flow" hint="Permission graph — arrives in MC-S2/S3">
        <div className={cn('mt-3 grid h-full place-items-center text-sm', vm.killed ? 'text-bad' : 'text-ink-mute')}>
          {vm.run ? `run: ${vm.statusKey}` : vm.isConnected ? 'connected · ready to grant' : 'idle · connect to begin'}
        </div>
      </Region>

      <Region area="leftrail" label="Left Rail · grant side" hint="SmartAccount · X-Ray · Tamper (MC-S6)" />
      <Region area="dossier" label="Right Dossier · execution" hint="TEE · tally · proof · x402 · 1Shot (MC-S7)" />
      <Region area="actions" label="Action Bar" hint="bound-mode + Grant/Vote/Recall (MC-S5)" />
      <Region area="trackrail" label="Track Rail" hint={t.scorecard?.title ?? '6 tracks (MC-S8)'} />
    </div>
  );
}
