"use client";

import type { BookMsg } from "@/hooks/useChartStream";

function fmtPrice(n: number) {
  if (!n) return "—";
  if (n >= 10000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 100)   return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export function OrderBookPanel({ book }: { book: BookMsg | null }) {
  const mid = book && book.bid && book.ask ? (book.bid + book.ask) / 2 : null;

  return (
    <div className="rounded-lg border border-border/40 bg-surface/60 p-3 space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-widest text-foreground/40">
        Order Book
      </p>

      <div className="space-y-1">
        {/* Ask */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-foreground/40 uppercase">Ask</span>
          <div className="flex-1 h-[3px] rounded-full bg-bearish/20 overflow-hidden">
            <div className="h-full w-full bg-bearish/40 origin-right" />
          </div>
          <span className="text-[11px] font-mono text-bearish tabular-nums">
            {fmtPrice(book?.ask ?? 0)}
          </span>
        </div>

        {/* Mid price */}
        {mid !== null && (
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[9px] font-mono text-foreground/30 uppercase tracking-wider">Mid</span>
            <span className="text-[10px] font-mono text-foreground/50 tabular-nums">
              {fmtPrice(mid)}
            </span>
          </div>
        )}

        {/* Bid */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-foreground/40 uppercase">Bid</span>
          <div className="flex-1 h-[3px] rounded-full bg-bullish/20 overflow-hidden">
            <div className="h-full w-full bg-bullish/40 origin-left" />
          </div>
          <span className="text-[11px] font-mono text-bullish tabular-nums">
            {fmtPrice(book?.bid ?? 0)}
          </span>
        </div>
      </div>

      <div className="pt-1 border-t border-border/30 flex items-center justify-between">
        <span className="text-[10px] font-mono text-foreground/40">Spread</span>
        <span className="text-[10px] font-mono text-foreground/60 tabular-nums">
          {book?.spread != null && book.spread > 0 ? `${book.spread.toFixed(4)}%` : "—"}
        </span>
      </div>
    </div>
  );
}
