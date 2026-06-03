'use client';

import { useEffect, useRef, useState } from 'react';
import type { RunStatus } from '@mandate/shared';
import { BadgeCheck, FileSignature, Lock, Sparkles } from 'lucide-react';
import { shortHex } from '../../lib/config';
import type { Dict } from '../../lib/i18n';
import { Badge } from '../ui/Badge';

type Play = 'off' | 'type' | 'full';

/**
 * Token-streaming hook — reveals text token-by-token with an irregular, LLM-like cadence (jittered
 * pauses, longer after punctuation). Timestamp-driven so a throttled / background tab still advances
 * and always snaps complete; honours prefers-reduced-motion by snapping instantly.
 */
function useTeeStream(full: string, play: Play): { text: string; typing: boolean } {
  const schedule = useRef<{ key: string | null; tokens: string[]; cum: number[] }>({ key: null, tokens: [], cum: [] });
  if (schedule.current.key !== full) {
    const tokens = full ? full.match(/\s*\S+/g) ?? [] : [];
    let acc = 0;
    const cum = tokens.map((tok, i) => {
      const last = tok[tok.length - 1];
      const jit = ((i * 2654435761) % 100) / 100; // deterministic 0..1 from index
      let dur = 34 + jit * 46; // 34–80ms base per token
      if (/[.…!?。]/.test(last)) dur += 260; // sentence pause
      else if (/[,;:,;:]/.test(last)) dur += 130; // clause pause
      acc += dur;
      return acc;
    });
    schedule.current = { key: full, tokens, cum };
  }
  const { tokens, cum } = schedule.current;
  const [n, setN] = useState(0);
  const reduce = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (play === 'off') {
      setN(0);
      return;
    }
    if (play === 'full' || reduce.current) {
      setN(tokens.length);
      return;
    }
    const start = Date.now();
    setN(0);
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      let k = 0;
      while (k < cum.length && cum[k] <= elapsed) k++;
      setN(k);
      if (k >= tokens.length) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [play, full, tokens, cum]);

  return { text: tokens.slice(0, n).join(''), typing: n < tokens.length };
}

function TeeCursor() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-3.5 w-[6px] translate-y-0.5 rounded-[1px] bg-info motion-safe:animate-pulse"
    />
  );
}

const decisionColor = (d?: string) => (d === 'For' ? 'var(--color-ok)' : d === 'Against' ? 'var(--color-bad)' : 'var(--color-warn)');

/**
 * The centerpiece Venice-TEE reasoning console. During "analyzing" it types a fallback reasoning
 * inside the sealed enclave; once the analyst's verdict lands it snaps to the real `venice` reasoning
 * and crystallizes the decision (JSON line + For/Against/Abstain badge + TEE-attested + signed-by).
 * Hidden before analysis and after the chain is severed.
 */
export function TeeConsole({
  venice,
  status,
  killed,
  t,
}: {
  venice: RunStatus['venice'];
  status?: string;
  killed: boolean;
  t: Dict;
}) {
  const analyzing = status === 'analyzing';
  const decided = ['decided', 'voting', 'voted'].includes(status ?? '');
  const active = analyzing || decided;
  const full = (venice?.reasoning && venice.reasoning.trim()) || t.teeFallbackReasoning;
  const showVerdict = decided && !!venice;
  const { text, typing } = useTeeStream(full, !active || killed ? 'off' : decided ? 'full' : 'type');

  if (!active || killed) return null;
  const tone = decisionColor(venice?.decision);

  return (
    <div
      className="w-full max-w-[620px] shrink-0 overflow-hidden rounded-[14px] border border-info/25 bg-[#070b14]/80 backdrop-blur"
      style={{ boxShadow: '0 0 0 1px rgba(110,168,254,.05), 0 20px 50px -28px rgba(0,0,0,.8)' }}
    >
      <div className="flex flex-wrap items-center gap-2.5 border-b border-info/15 bg-info/[0.06] px-3.5 py-2.5">
        <Lock className="size-3.5 text-info" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-info">{t.teeConsoleTitle}</span>
        <span className="inline-flex items-center gap-1.5 rounded-chip border border-info/35 bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">
          <Sparkles className="size-3" /> Venice AI · TEE
        </span>
        <span className="ml-auto font-mono text-[11px] text-ink-mute">{venice?.model ?? 'venice/llama-3.3-70b'}</span>
      </div>
      <div className="px-4 py-3.5">
        <div className="min-h-[54px] whitespace-pre-wrap break-words font-mono text-[12.5px] leading-[1.65] text-[#8aa0f0]">
          {text}
          {typing && <TeeCursor />}
        </div>
        {showVerdict && venice && (
          <div>
            <code className="mt-3 block break-all rounded-md border border-hairline bg-surface-2 px-2.5 py-[7px] font-mono text-[11.5px] text-ink-mute">
              {`{"decision":"${venice.decision}","rationale":"…"}`}
            </code>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">{t.aiDecided}</span>
              <span
                className="inline-flex items-center rounded-chip px-3 py-1 text-[13px] font-bold"
                style={{ border: `1px solid ${tone}66`, background: `${tone}1f`, color: tone }}
              >
                {venice.decision}
              </span>
              {venice.attestation?.verified && (
                <Badge tone="ok">
                  <BadgeCheck className="size-3" /> {t.teeAttested}
                </Badge>
              )}
              {venice.signature?.recovered && venice.signature.signingAddress && (
                <Badge tone="info">
                  <FileSignature className="size-3" /> {shortHex(venice.signature.signingAddress, 4)}
                </Badge>
              )}
            </div>
            {venice.rationale && <div className="mt-2.5 text-[13px] italic text-ink-soft">“{venice.rationale}”</div>}
          </div>
        )}
      </div>
    </div>
  );
}
