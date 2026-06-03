'use client';

import { Check, Coins, Rocket, Zap } from 'lucide-react';
import type { Dict } from '../../lib/i18n';
import type { PanelKey } from './IconRail';

/**
 * x402 + 1Shot surfaced as native high-value capability cards (not buried in a sidebar), with the
 * met-track micro badges (4337 · 7710 · A2A · TEE) below — the judge-readable "what this proves"
 * row. Clicking a card opens its popover.
 */
export function CapabilityDock({ t, onOpen, granted }: { t: Dict; onOpen: (key: PanelKey) => void; granted: boolean }) {
  const met = [
    { label: '4337', on: true },
    { label: '7710', on: granted },
    { label: 'A2A', on: granted },
    { label: 'TEE', on: granted },
  ];
  return (
    <div className="flex flex-col items-center gap-3.5">
      <div className="mc-dock">
        <button type="button" className="mc-cap orange" onClick={() => onOpen('x402')} aria-label={t.panels.x402}>
          <span className="mc-cap-ic">
            <Coins className="size-[19px]" />
          </span>
          <span>
            <span className="mc-cap-k">
              x402 <span className="live-dot" />
            </span>
            <span className="mc-cap-v">0.01 MVOTE / {t.x402.perQuery}</span>
          </span>
        </button>

        <button type="button" className="mc-cap cyan" onClick={() => onOpen('oneshot')} aria-label={t.panels.oneshot}>
          <span className="mc-cap-ic">
            <Rocket className="size-[19px]" />
          </span>
          <span>
            <span className="mc-cap-k">
              1Shot <Zap className="size-3.5 text-cyan" />
            </span>
            <span className="mc-cap-v">{t.capOneShot}</span>
          </span>
        </button>
      </div>

      <div className="mc-tracks">
        {met.map((m) => (
          <span key={m.label} className={`mc-chip${m.on ? ' met' : ''}`}>
            {m.on && <Check className="size-3" />}
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
