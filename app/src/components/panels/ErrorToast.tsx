'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

const AUTO_DISMISS_MS = 10_000;

/**
 * Floating error toast (top-right). Transient surface — a tinted, blurred pill so a failure is
 * always legible over the living graph without claiming a slot in the dossier column. The ✕ (or
 * a 10s timer) clears it via `onClose`; the message arriving here is already humanized (no raw
 * viem traces — see lib/errors.ts).
 */
export function ErrorToast({ error, onClose, dismissLabel }: { error: string | null; onClose?: () => void; dismissLabel?: string }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!error || !onClose) return;
    const id = setTimeout(onClose, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [error, onClose]);

  return (
    <AnimatePresence>
      {error && (
        <motion.div
          key="err"
          initial={reduce ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-auto fixed right-4 top-[74px] z-[40] max-w-[340px]"
        >
          <div className="flex items-start gap-2 rounded-xl border border-bad/40 bg-bad/12 px-3.5 py-2.5 text-[12.5px] text-bad shadow-[0_8px_30px_-10px_rgba(0,0,0,0.7)] backdrop-blur-md">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span className="line-clamp-3 break-words">{error}</span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={dismissLabel ?? 'Dismiss'}
                title={dismissLabel ?? 'Dismiss'}
                className="-mr-1 -mt-0.5 shrink-0 rounded-md bg-none p-1 font-normal text-bad/70 shadow-none transition-colors hover:bg-bad/15 hover:text-bad"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
