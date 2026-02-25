"use client";

import type { BookMsg } from "@/hooks/useChartStream";

function fmt(n: number, decimals = 2) {
  if (!n) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function OrderBookPanel({ book }: { book: BookMsg | null }) {
  return (
    <div className="rounded-lg border border-border/40 bg-surface/60 p-3 space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-widest text-foreground/40">
        Order Book
      </p>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-foreground/40 uppercase">Ask</span>
          <span className="text-xs font-mono text-bearish">
            {fmt(book?.ask ?? 0)}
          </span>
        </div>

        {/* Spread bar */}
        <div className="h-px bg-border/60 relative overflow-hidden">
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-bullish/20" />
            <div className="flex-1 bg-bearish/20" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-foreground/40 uppercase">Bid</span>
          <span className="text-xs font-mono text-bullish">
            {fmt(book?.bid ?? 0)}
          </span>
        </div>
      </div>

      <div className="pt-1 border-t border-border/30 flex items-center justify-between">
        <span className="text-[10px] font-mono text-foreground/40">Spread</span>
        <span className="text-[10px] font-mono text-foreground/60">
          {book?.spread != null ? `${book.spread.toFixed(4)}%` : "—"}
        </span>
      </div>
    </div>
  );
}
