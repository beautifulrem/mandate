'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { AlertTriangle, CheckCircle2, Cpu, ExternalLink, Play, Radio, Rocket } from 'lucide-react';
import { MAINNET_PROOF, RELAY_PHASES, parse7702Code } from '../lib/oneshot-finale';
import { shortHex } from '../lib/config';
import { cn } from '../lib/cn';
import type { Dict } from '../lib/i18n';
import { Panel, PanelHeader } from './ui/Panel';
import { Badge, TrackTag } from './ui/Badge';

type Phase = 'idle' | 'running' | 'done';

/**
 * The 1Shot mainnet finale (Best 1Shot + 7702 + 7710 mainnet relay). Honestly labelled a replay
 * of the real relay: the stepper + tx + USDC fee are pinned real artifacts, but the 7702-upgrade
 * proof is a GENUINELY LIVE, free, read-only eth_getCode on Base mainnet — no wallet, no gas.
 */
export function OneShotFinale({ t, bare = false }: { t: Dict; bare?: boolean }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState(0);
  const [code, setCode] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ status: 'success' | 'reverted'; block: string; gasUsed: string; live: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setPhase('running');
    setErr(null);
    setStep(0);
    setCode(null);
    setReceipt(null);
    try {
      for (let i = 1; i <= RELAY_PHASES.length; i++) {
        await new Promise((r) => setTimeout(r, reduce ? 0 : 520));
        setStep(i);
      }
      const client = createPublicClient({ chain: base, transport: http(MAINNET_PROOF.rpc) });
      const c = await client.getCode({ address: MAINNET_PROOF.burner });
      setCode(c ?? '0x');
      // confirmed receipt (block + gas, not just a hash): try a live read, fall back to the
      // recorded values — either way it's the real tx, verifiable via the BaseScan link.
      let rc: { status: 'success' | 'reverted'; block: string; gasUsed: string; live: boolean } = {
        status: 'success',
        block: String(MAINNET_PROOF.block),
        gasUsed: String(MAINNET_PROOF.gasUsed),
        live: false,
      };
      try {
        const r = await client.getTransactionReceipt({ hash: MAINNET_PROOF.castVoteTx });
        rc = { status: r.status, block: r.blockNumber.toString(), gasUsed: r.gasUsed.toString(), live: true };
      } catch {
        /* keep the recorded fallback */
      }
      setReceipt(rc);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPhase('done');
    }
  }

  if (phase === 'idle') {
    return (
      <Panel tone="eth" pad="lg" bare={bare} className={`${bare ? '' : 'mb-3.5 '}flex flex-col items-center gap-3 text-center`}>
        <div className="flex items-center justify-center gap-2 text-[13px] text-ink-soft">
          <Radio className="size-4 shrink-0 text-[#8aa0f0]" /> {t.oneShotCtaHint}
        </div>
        <button onClick={run} className="inline-flex items-center gap-2">
          <Play className="size-4" /> {t.oneShotCtaBtn}
        </button>
      </Panel>
    );
  }

  const parsed = parse7702Code(code);

  return (
    <Panel tone="eth" pad="lg" bare={bare} className={bare ? '' : 'mb-3.5'}>
      <PanelHeader
        icon={Rocket}
        title={t.oneShotTitle}
        track={<TrackTag tone="eth" icon={Cpu}>1Shot · mainnet 7710 + 7702</TrackTag>}
        right={<Badge tone="eth">{t.oneShotMainnet}</Badge>}
      />

      {/* relay lifecycle — a vertical step log; each phase explains what the 1Shot relayer does */}
      <div className="flex flex-col gap-2.5">
        {RELAY_PHASES.map((p, i) => {
          const state = step > i ? 'done' : step === i ? 'current' : 'idle';
          return (
            <div key={p.key} className={cn('flex gap-2.5 transition-opacity', state === 'idle' ? 'opacity-45' : 'opacity-100')}>
              <span className={cn('mt-1 size-2.5 shrink-0 rounded-full', state === 'done' ? 'bg-ok' : state === 'current' ? 'bg-brand motion-safe:animate-glow' : 'bg-line')} />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink-soft">
                  {t.relayPhases[p.key]} <span className="font-mono text-[11px] font-normal text-ink-mute">· {p.code}</span>
                </div>
                <div className="text-[11.5px] leading-snug text-ink-mute">{t.oneShotRelayDesc[p.key]}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* burner 7702 upgrade — genuinely live read-only eth_getCode on Base mainnet */}
      <div className={cn('mt-4 rounded-xl border bg-surface-2/60 px-4 py-3.5 transition-colors', parsed.upgraded ? 'border-brand/40' : 'border-hairline')}>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
          {t.oneShotBurner}
          <a className="font-mono text-info hover:underline" href={`${MAINNET_PROOF.basescan}/address/${MAINNET_PROOF.burner}`} target="_blank" rel="noreferrer">
            {shortHex(MAINNET_PROOF.burner, 4)} ↗
          </a>
        </div>
        {phase === 'running' && !code && (
          <div className="mt-2 font-mono text-[11px] text-ink-mute motion-safe:animate-pulse">{t.oneShotChecking}</div>
        )}
        {parsed.upgraded && (
          <motion.div
            className="mt-2"
            initial={reduce ? false : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 20 }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">
                <CheckCircle2 className="size-3" /> {t.oneShot7702}
              </Badge>
              <LiveTag label={t.oneShotLive} />
            </div>
            <div className="mt-2 break-all font-mono text-[11.5px] text-ink-mute">
              0xef0100<span className="text-brand">{parsed.implementation?.slice(2)}</span>
            </div>
            <div className="mt-1.5 text-[11px] text-ink-mute">
              {t.oneShotImpl} <span className="font-mono text-ink-soft">{shortHex(parsed.implementation, 5)}</span>
            </div>
          </motion.div>
        )}
        {code && !parsed.upgraded && <div className="mt-2 text-[12px] text-bad">{t.oneShotNotUpgraded}</div>}
        {err && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-bad">
            <AlertTriangle className="size-3.5" /> {err}
          </div>
        )}
      </div>

      {/* proof wall — pinned real on-chain artifacts */}
      <div className="mt-4 rounded-xl border border-hairline bg-surface-2/60 px-4 py-3.5">
        <div className="flex flex-wrap gap-2">
          <Badge tone="ok">{t.oneShotGasUsdc}</Badge>
          <Badge tone="neutral">{t.oneShotBurnerNoEth}</Badge>
        </div>
        <a
          className="mt-3 inline-flex items-center gap-1.5 font-mono text-[12px] text-info hover:underline"
          href={`${MAINNET_PROOF.basescan}/tx/${MAINNET_PROOF.castVoteTx}`}
          target="_blank"
          rel="noreferrer"
        >
          {t.oneShotCastVoteTx} {shortHex(MAINNET_PROOF.castVoteTx, 6)} <ExternalLink className="size-3" />
        </a>
        {phase === 'running' && !receipt && (
          <div className="mt-2 font-mono text-[11px] text-ink-mute motion-safe:animate-pulse">{t.oneShotReceiptReading}</div>
        )}
        {receipt && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge tone={receipt.status === 'success' ? 'ok' : 'bad'}>
              <CheckCircle2 className="size-3" /> {receipt.status === 'success' ? t.oneShotTxConfirmed : 'reverted'}
            </Badge>
            <span className="font-mono text-[11px] text-ink-soft">
              {t.oneShotBlock} #{receipt.block}
            </span>
            <span className="font-mono text-[11px] text-ink-soft">
              {t.oneShotGasUsed} {Number(receipt.gasUsed).toLocaleString()}
            </span>
            {receipt.live && <LiveTag label={t.oneShotLive} />}
          </div>
        )}
        <div className="mt-2.5 text-[11px] leading-relaxed text-ink-mute">{t.oneShotBundle}</div>
      </div>
    </Panel>
  );
}

/** A small "live read" chip — marks data fetched live on-chain (vs the replayed lifecycle steps). */
function LiveTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-chip border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-info">
      <span className="size-1.5 rounded-full bg-info motion-safe:animate-pulse" /> {label}
    </span>
  );
}
