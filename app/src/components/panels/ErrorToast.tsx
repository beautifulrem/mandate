'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

/**
 * Floating error toast (top-right). Transient surface — a tinted, blurred pill so a failure is
 * always legible over the living graph without claiming a slot in the dossier column.
 */
export function ErrorToast({ error }: { error: string | null }) {
  const reduce = useReducedMotion();
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
