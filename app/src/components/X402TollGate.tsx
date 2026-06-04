'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { createPublicClient, erc20Abi, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { AlertTriangle, Bot, Coins, Receipt, Scale, ShieldCheck, User, Wallet } from 'lucide-react';
import { BASESCAN, RPC_URL, shortHex } from '../lib/config';
import { cn } from '../lib/cn';
import type { RunStatus } from '@mandate/shared';
import { TOLL_DECIMALS, TOLL_SYMBOL, X402_PHASES, formatTokenAmount, tollChallenge, tollResource } from '../lib/x402-toll';
import type { DemoConfig } from '../lib/orchestrator';
import type { Dict } from '../lib/i18n';
import { Panel, PanelHeader } from './ui/Panel';
import { Badge, TrackTag } from './ui/Badge';

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 text-ink-mute">{k}</span>
      <span className="min-w-0 break-all text-ink-soft">{v}</span>
    </div>
  );
}

/** A mini replica of the cockpit's authority graph for the popover: circular 你→编排器→终裁 nodes
 *  joined by a dashed beam, with a spinning gold coin that loops the path while tracing/settling and
 *  cyan AI-data squares streaming back — so the popover speaks the same visual language as the graph. */
function MiniPaymentDiagram({ cap, spent, playing, delivered, t }: { cap?: number; spent: number; playing: boolean; delivered: boolean; t: Dict }) {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const n0 = useRef<HTMLDivElement>(null);
  const n1 = useRef<HTMLDivElement>(null);
  const n2 = useRef<HTMLDivElement>(null);
  const coin = useRef<HTMLDivElement>(null);
  const [g, setG] = useState<{ p: { x: number; y: number }[]; w: number; h: number } | null>(null);

  useEffect(() => {
    const compute = () => {
      if (!wrap.current || !n0.current || !n1.current || !n2.current) return;
      const cr = wrap.current.getBoundingClientRect();
      const c = (n: HTMLDivElement) => {
        const r = n.getBoundingClientRect();
        return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 };
      };
      setG({ p: [c(n0.current), c(n1.current), c(n2.current)], w: cr.width, h: cr.height });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = coin.current;
    if (!g || !el || reduce) return;
    if (!playing) {
      el.style.opacity = '0';
      return;
    }
    const [a, b, d] = g.p;
    const l1 = Math.hypot(b.x - a.x, b.y - a.y);
    const l2 = Math.hypot(d.x - b.x, d.y - b.y);
    const total = l1 + l2 || 1;
    const at = (pr: number) => {
      const dd = pr * total;
      if (dd <= l1) {
        const u = l1 ? dd / l1 : 0;
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      }
      const u = l2 ? (dd - l1) / l2 : 0;
      return { x: b.x + (d.x - b.x) * u, y: b.y + (d.y - b.y) * u };
    };
    const controls = animate(0, 1, {
      duration: 1.7,
      ease: 'linear',
      repeat: Infinity,
      onUpdate: (pr) => {
        const pt = at(pr);
        el.style.transform = `translate3d(${pt.x - 9}px, ${pt.y - 9}px, 0)`;
        el.style.opacity = pr < 0.06 || pr > 0.94 ? '0' : '1';
      },
    });
    return () => controls.stop();
  }, [g, playing, reduce]);

  const nodes = [
    { ref: n0, icon: User, label: t.x402.buyerYou, tone: '#ffd470' },
    { ref: n1, icon: Bot, label: t.nodes.orch.who, tone: 'var(--color-brand)' },
    { ref: n2, icon: Scale, label: t.nodes.synthesis.who, tone: '#ffd470' },
  ];
  const beamPath = g ? `M ${g.p[0].x} ${g.p[0].y} L ${g.p[1].x} ${g.p[1].y} L ${g.p[2].x} ${g.p[2].y}` : '';
  return (
    <div ref={wrap} className="relative mt-4 rounded-xl border border-ok/20 bg-surface-2/40 px-2 pb-5 pt-3" style={{ height: 104 }}>
      {g && (
        <svg className="pointer-events-none absolute inset-0" width={g.w} height={g.h} style={{ overflow: 'visible' }} aria-hidden>
          <path className="beam-base" d={beamPath} />
          {playing && <path className="beam-pulse" d={beamPath} stroke="#ffd470" style={{ color: '#ffd470' }} />}
        </svg>
      )}
      <div className="relative flex items-start justify-between px-2">
        {nodes.map((n, i) => (
          <div key={i} className="flex w-16 flex-col items-center gap-1 text-center">
            <div
              ref={n.ref}
              className="grid size-8 place-items-center rounded-full border"
              style={{ borderColor: n.tone, color: n.tone, background: 'rgba(20,25,37,.6)', boxShadow: `0 0 0 4px color-mix(in srgb, ${n.tone} 12%, transparent)` }}
            >
              <n.icon className="size-4" />
            </div>
            <span className="text-[10px] font-semibold text-ink-soft">{n.label}</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-1.5 text-center font-mono text-[9.5px] text-ink-mute">
        Erc20TransferAmount · {spent}/{cap ?? '∞'} {t.x402.spent} (≤ {cap ?? '∞'} {TOLL_SYMBOL})
      </div>
      <div ref={coin} className="pay-coin" style={{ opacity: 0 }}>
        <div className="pay-coin-face" />
      </div>
      {g &&
        delivered &&
        !reduce &&
        [0, 1, 2, 3].map((i) => (
          <span
            key={`d-${i}`}
            className="data-packet"
            style={
              {
                left: g.p[2].x,
                top: g.p[2].y,
                '--dx': `${g.p[0].x - g.p[2].x}px`,
                '--dy': `${g.p[0].y - g.p[2].y}px`,
                animationDelay: `${i * 0.18}s`,
                animationIterationCount: 'infinite',
              } as CSSProperties
            }
          />
        ))}
    </div>
  );
}

/**
 * x402 pay-per-query toll gate. Renders the real 402 challenge (scheme erc7710) and the SCOPED
 * Erc20TransferAmount delegation that settles it, then traces the 402 -> sign -> redeem -> 200
 * lifecycle and reads the seller's live MVOTE balance on-chain (read-only — no spend).
 */
export function X402TollGate({
  cfg,
  t,
  bare = false,
  toll,
  queryCount = 0,
  cap,
  proposalId,
}: {
  cfg: DemoConfig;
  t: Dict;
  bare?: boolean;
  /** a REAL per-vote toll the analyst pulled on-chain (present once a vote has settled one). */
  toll?: RunStatus['toll'];
  /** how many queries have been billed under the current mandate (drives the running count). */
  queryCount?: number;
  /** the cumulative budget cap in queries (= mUSDC), from the grant; undefined if no grant. */
  cap?: number;
  /** the proposal being priced — its #id is shown in the resource path. */
  proposalId?: bigint | string | null;
}) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [tracing, setTracing] = useState(false);
  const [bal, setBal] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // when a real toll has settled, the rail shows live on-chain proof; otherwise it traces the lifecycle.
  const resource = toll?.resource ?? tollResource(proposalId);
  const req = tollChallenge({ asset: cfg.paymentToken, payTo: cfg.analyst, chainId: cfg.chainId, resource }).accepts[0];
  const price = formatTokenAmount(BigInt(req.maxAmountRequired), TOLL_DECIMALS);
  const phaseStep = toll ? X402_PHASES.length : step; // a real settlement marks the whole lifecycle done
  const sellerBalanceFmt = toll ? formatTokenAmount(BigInt(toll.sellerBalance), TOLL_DECIMALS) : bal;

  async function trace() {
    setTracing(true);
    setErr(null);
    setStep(0);
    setBal(null);
    try {
      for (let i = 1; i <= X402_PHASES.length; i++) {
        await new Promise((r) => setTimeout(r, reduce ? 0 : 520));
        setStep(i);
      }
      const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
      const raw = (await client.readContract({
        address: cfg.paymentToken,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [cfg.analyst],
      })) as bigint;
      setBal(formatTokenAmount(raw, TOLL_DECIMALS));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setTracing(false);
    }
  }

  return (
    <Panel tone="ok" pad="lg" bare={bare} className={bare ? '' : 'mb-3.5'}>
      <PanelHeader
        icon={Coins}
        title={t.x402.title}
        track={<TrackTag tone="ok" icon={Receipt}>x402 · ERC-7710</TrackTag>}
        right={<Badge tone="neutral">{TOLL_SYMBOL}/{t.x402.perQuery}</Badge>}
      />
      <p className="text-[13px] leading-relaxed text-ink-soft">{t.x402.hint}</p>

      {/* payment FLOW — a mini replica of the cockpit authority graph (你→编排器→终裁), animated */}
      <MiniPaymentDiagram cap={cap} spent={queryCount} playing={tracing || !!toll} delivered={!!toll || phaseStep >= 3} t={t} />

      {/* the real 402 challenge */}
      <div className="mt-4 overflow-hidden rounded-xl border border-warn/25 bg-[#0e0b06]/70">
        <div className="border-b border-warn/15 bg-warn/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-warn">
          {t.x402.require}
        </div>
        <div className="grid gap-1.5 px-4 py-3 font-mono text-[12px]">
          <Row k="scheme" v={req.scheme} />
          <Row
            k="asset"
            v={
              <a className="text-info hover:underline" href={`${BASESCAN}/address/${req.asset}`} target="_blank" rel="noreferrer">
                {TOLL_SYMBOL} {shortHex(req.asset, 4)} ↗
              </a>
            }
          />
          <Row
            k="payTo"
            v={
              <a className="text-info hover:underline" href={`${BASESCAN}/address/${req.payTo}`} target="_blank" rel="noreferrer">
                {shortHex(req.payTo, 4)} ↗
              </a>
            }
          />
          <Row k="price" v={<span className="text-ink">{price} {TOLL_SYMBOL} <span className="text-ink-mute">/ {t.x402.perQuery}</span></span>} />
          <Row k="resource" v={req.resource} />
        </div>
      </div>

      {/* scoped ERC-7710 payment delegation */}
      <div className="mt-4 rounded-xl border border-ok/25 bg-surface-2/60 px-4 py-3.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
          <ShieldCheck className="size-3.5 text-ok" /> {t.x402.scopeTitle}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="ok">Erc20TransferAmount</Badge>
          <Badge tone="neutral">cap = {price} {TOLL_SYMBOL}</Badge>
          <Badge tone="neutral">to = {shortHex(cfg.analyst, 4)}</Badge>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-mute">{t.x402.scopeNote}</p>
      </div>

      {/* lifecycle — a vertical step log; each phase explains what actually happens */}
      <div className="mt-4 flex flex-col gap-2.5">
        {X402_PHASES.map((p, i) => {
          const state = phaseStep === 0 ? 'idle' : phaseStep > i ? 'done' : phaseStep === i ? 'current' : 'idle';
          return (
            <div key={p.key} className={cn('flex gap-2.5 transition-opacity', state === 'idle' ? 'opacity-45' : 'opacity-100')}>
              <span className={cn('mt-1 size-2.5 shrink-0 rounded-full', state === 'done' ? 'bg-ok' : state === 'current' ? 'bg-brand motion-safe:animate-glow' : 'bg-line')} />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink-soft">
                  {t.x402.phases[p.key]}
                  {p.code != null && <span className="font-mono text-[11px] font-normal text-ink-mute"> · {p.code}</span>}
                </div>
                <div className="text-[11.5px] leading-snug text-ink-mute">{t.x402.phaseDesc[p.key]}</div>
              </div>
            </div>
          );
        })}
      </div>

      {toll ? (
        /* a REAL per-vote settlement — the on-chain redeem tx + the seller's real balance + running count */
        <div className="mt-4 rounded-xl border border-ok/25 bg-ok/[0.06] px-4 py-3.5">
          <p className="text-[12.5px] leading-relaxed text-ink-soft">{t.x402.result}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge tone="ok">
              <Receipt className="size-3" /> {t.x402.settled}
              {queryCount > 0 ? ` · ${queryCount}` : ''}
            </Badge>
            <a className="font-mono text-[12px] text-info hover:underline" href={`${BASESCAN}/tx/${toll.txHash}`} target="_blank" rel="noreferrer">
              {shortHex(toll.txHash, 5)} ↗
            </a>
            <Badge tone="ok">
              <Wallet className="size-3" /> {t.x402.sellerBalance}: {sellerBalanceFmt} {TOLL_SYMBOL}
            </Badge>
            <span className="inline-flex items-center gap-1.5 rounded-chip border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-info">
              <span className="size-1.5 rounded-full bg-info motion-safe:animate-pulse" /> {t.x402.liveRead}
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button onClick={trace} disabled={tracing} className="inline-flex items-center gap-2">
              <Wallet className="size-4" /> {tracing ? t.x402.tracing : t.x402.trace}
            </button>
            {tracing && step >= X402_PHASES.length && bal === null && (
              <span className="font-mono text-[11px] text-ink-mute motion-safe:animate-pulse">{t.x402.reading}</span>
            )}
            {err && (
              <span className="flex items-center gap-1.5 text-[12px] text-bad">
                <AlertTriangle className="size-3.5" /> {err}
              </span>
            )}
          </div>

          {/* result — plain-language outcome + the seller's real on-chain balance (the actual proof) */}
          {bal !== null && (
            <div className="mt-3 rounded-xl border border-ok/25 bg-ok/[0.06] px-4 py-3.5">
              <p className="text-[12.5px] leading-relaxed text-ink-soft">{t.x402.result}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Badge tone="ok">
                  <Wallet className="size-3" /> {t.x402.sellerBalance}: {bal} {TOLL_SYMBOL}
                </Badge>
                <span className="inline-flex items-center gap-1.5 rounded-chip border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-info">
                  <span className="size-1.5 rounded-full bg-info motion-safe:animate-pulse" /> {t.x402.liveRead}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
