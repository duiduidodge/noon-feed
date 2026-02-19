'use client';

import { X, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface SummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    title: string;
    date: string;
}

export function SummaryModal({ isOpen, onClose, children, title, date }: SummaryModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-md"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 14 }}
          transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          className="relative z-[101] flex h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border/40 bg-card shadow-2xl ring-1 ring-border/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border/15 px-4 py-3 sm:px-5 sm:py-4">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 font-mono-data text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
                <Calendar className="h-3 w-3" />
                {date}
              </div>
              <h2 className="truncate font-display text-base font-bold uppercase tracking-wide text-foreground sm:text-xl">
                {title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface/60 hover:text-foreground"
              aria-label="Close summary modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
            {children}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
