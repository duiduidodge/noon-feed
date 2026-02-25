"use client";

import type { TradeMsg } from "@/hooks/useChartStream";
import clsx from "clsx";

function formatTime(ms: number) {
  const d = new Date(ms);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtPrice(n: number) {
  if (n >= 10000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function TradesPanel({ trades }: { trades: TradeMsg[] }) {
  return (
    <div className="border-t border-border/40 bg-surface/30 px-4 py-2 flex items-center gap-1 overflow-x-auto">
      <span className="text-[10px] font-mono text-foreground/30 uppercase tracking-widest shrink-0 mr-2">
        Trades
      </span>
      {trades.length === 0 ? (
        <span className="text-[10px] font-mono text-foreground/20">waiting for stream…</span>
      ) : (
        [...trades].reverse().map((t, i) => (
          <span
            key={i}
            className={clsx(
              "shrink-0 text-[10px] font-mono px-2 py-0.5 rounded transition-opacity",
              i === 0 ? "opacity-100" : "opacity-60",
              t.side === "buy"
                ? "bg-bullish/10 text-bullish"
                : "bg-bearish/10 text-bearish"
            )}
          >
            {t.side === "buy" ? "▲" : "▼"} {fmtPrice(t.price)}{" "}
            <span className="opacity-60 text-[9px]">{t.size.toFixed(3)}</span>
          </span>
        ))
      )}
    </div>
  );
}
