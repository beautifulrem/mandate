'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BadgeCheck, FileSignature, Lock } from 'lucide-react';
import type { VeniceTrace } from '@mandate/shared';
import { shortHex } from '../lib/config';
import type { Dict } from '../lib/i18n';
import { Badge, TrackTag } from './ui/Badge';

const decisionTone = (d?: string): 'ok' | 'bad' | 'warn' => (d === 'For' ? 'ok' : d === 'Against' ? 'bad' : 'warn');

/**
 * Venice TEE console. Replays the model's private reasoning progressively (it arrives at once on
 * the 'decided' poll; revealed client-side so a judge SEES the AI think), then crystallizes the
 * For/Against verdict from the final JSON line. Attestation + signed-by (ecrecover) badges surface
 * the TEE proofs. The decision shown is the real venice.decision the analyst cast on-chain.
 */
export function TeeReasoningStream({ venice, t }: { venice: VeniceTrace; t: Dict }) {
  const reduce = useReducedMotion();
  const full = (venice.reasoning && venice.reasoning.trim()) || t.teeFallbackReasoning;
  const [shown, setShown] = useState(reduce ? full.length : 0);
  const done = shown >= full.length;

  useEffect(() => {
    if (reduce) {
      setShown(full.length);
      return;
    }
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(full.length, i + 3);
      setShown(i);
      if (i >= full.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [full, reduce]);

  const jsonLine = `{"decision":"${venice.decision}","rationale":"${venice.rationale}"}`;

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-info/25 bg-[#070b14]/80 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 border-b border-info/15 bg-info/5 px-4 py-2.5">
        <Lock className="size-3.5 text-info" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-info">{t.teeConsoleTitle}</span>
        <TrackTag tone="info">Venice AI · TEE</TrackTag>
        <span className="ml-auto font-mono text-[11px] text-ink-mute">{venice.model}</span>
      </div>
      <div className="px-4 py-3">
        <div className="min-h-[40px] whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-info">
          {full.slice(0, shown)}
          {!done && <span className="ml-0.5 inline-block h-3.5 w-[7px] translate-y-0.5 bg-info motion-safe:animate-pulse" aria-hidden />}
        </div>
        {done && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3"
          >
            <code className="block break-all rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 font-mono text-[11.5px] text-ink-mute">
              {jsonLine}
            </code>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">{t.aiDecided}</span>
              <motion.span
                initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 18 }}
              >
                <Badge tone={decisionTone(venice.decision)}>{venice.decision}</Badge>
              </motion.span>
              {venice.attestation.verified && (
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
            <div className="mt-2 text-[13px] italic text-ink-soft">“{venice.rationale}”</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
