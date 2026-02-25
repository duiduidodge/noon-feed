"use client";

import type { TradeMsg } from "@/hooks/useChartStream";
import clsx from "clsx";

function fmtPrice(n: number) {
  if (n >= 10000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100)   return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function fmtSize(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1)    return n.toFixed(3);
  return n.toFixed(4);
}

// USD value threshold for a "whale" trade
const WHALE_USD = 50_000;

export function TradesPanel({ trades }: { trades: TradeMsg[] }) {
  // Buy/sell volume split across the buffered trades
  let buyVol = 0, sellVol = 0;
  for (const t of trades) {
    const usd = t.price * t.size;
    if (t.side === "buy") buyVol += usd; else sellVol += usd;
  }
  const totalVol = buyVol + sellVol;
  const buyPct   = totalVol > 0 ? (buyVol / totalVol) * 100 : 50;

  return (
    <div className="border-t border-border/40 bg-surface/20 shrink-0">
      {/* Buy / Sell flow ratio bar */}
      <div className="px-3 pt-1.5 pb-1 flex items-center gap-2">
        <span className="text-[9px] font-mono uppercase tracking-widest text-foreground/30 shrink-0">
          Flow
        </span>
        <div className="flex-1 h-[5px] rounded-full overflow-hidden bg-surface/60 flex">
          <div
            className="bg-bullish/70 h-full transition-all duration-300"
            style={{ width: `${buyPct}%` }}
          />
          <div className="bg-bearish/70 h-full flex-1" />
        </div>
        <span className="text-[9px] font-mono text-bullish shrink-0 w-8 text-right">
          {buyPct.toFixed(0)}%
        </span>
        <span className="text-[9px] font-mono text-foreground/25 shrink-0">|</span>
        <span className="text-[9px] font-mono text-bearish shrink-0 w-8">
          {(100 - buyPct).toFixed(0)}%
        </span>
      </div>

      {/* Trades ticker */}
      <div className="flex items-center gap-1 px-3 pb-2 overflow-x-auto">
        {trades.length === 0 ? (
          <span className="text-[10px] font-mono text-foreground/20">waiting for stream…</span>
        ) : (
          trades.slice(0, 35).map((t, i) => {
            const usd = t.price * t.size;
            const isWhale = usd >= WHALE_USD;
            return (
              <span
                key={i}
                title={`$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                className={clsx(
                  "shrink-0 font-mono transition-opacity",
                  i === 0 ? "opacity-100" : i < 6 ? "opacity-75" : "opacity-45",
                  isWhale
                    ? clsx(
                        "text-[10px] px-2 py-0.5 rounded font-bold border",
                        t.side === "buy"
                          ? "bg-bullish/20 text-bullish border-bullish/40"
                          : "bg-bearish/20 text-bearish border-bearish/40"
                      )
                    : clsx(
                        "text-[10px] px-1.5 py-0.5 rounded",
                        t.side === "buy"
                          ? "bg-bullish/8 text-bullish/80"
                          : "bg-bearish/8 text-bearish/80"
                      )
                )}
              >
                {t.side === "buy" ? "▲" : "▼"} {fmtPrice(t.price)}
                {isWhale && (
                  <span className="ml-1 text-[9px] opacity-80">
                    {fmtSize(t.size)}
                  </span>
                )}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
