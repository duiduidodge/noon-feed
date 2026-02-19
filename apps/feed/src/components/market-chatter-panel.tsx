'use client';

import { cn } from '@/lib/utils';
import { Radio } from 'lucide-react';
import { LowImpactFeed } from './low-impact-feed';

interface MarketChatterPanelProps {
  className?: string;
  id?: string;
}

export function MarketChatterPanel({ className, id }: MarketChatterPanelProps) {
  return (
    <div
      id={id}
      className={cn(
        'flex flex-col min-h-0 overflow-hidden',
        'rounded-2xl border border-border/50',
        'bg-card/72 backdrop-blur-sm',
        'column-panel',
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-border/30 bg-surface/18 px-3 py-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-muted-foreground/60 animate-pulse" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/84 font-mono-data">
            Market Chatter
          </span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-border/40 to-transparent" />
        <span className="text-[8px] font-mono-data text-muted-foreground/30 uppercase tracking-wider">
          30s
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="px-3 py-3">
          <LowImpactFeed standalone limit={14} />
        </div>
      </div>
    </div>
  );
}
