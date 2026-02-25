"use client";

import type { FundingMsg, LiquidationMsg, OIMsg } from "@/hooks/useChartStream";
import clsx from "clsx";

function formatRate(rate: number) {
  if (!rate) return "—";
  const pct = (rate * 100).toFixed(4);
  return `${rate >= 0 ? "+" : ""}${pct}%`;
}

function formatTime(ms: number) {
  if (!ms) return "—";
  const diff = ms - Date.now();
  if (diff <= 0) return "now";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtUsd(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtOI(oi: number) {
  // BinanceFutures OI is in base currency units (e.g. BTC)
  if (oi >= 1_000_000) return `${(oi / 1_000_000).toFixed(2)}M`;
  if (oi >= 1_000)     return `${(oi / 1_000).toFixed(2)}K`;
  return oi.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function FundingPanel({
  funding,
  oi,
  liquidations,
}: {
  funding: FundingMsg | null;
  oi: OIMsg | null;
  liquidations: LiquidationMsg[];
}) {
  const rate = funding?.rate ?? 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Funding rate + Open Interest (combined card) */}
      <div className="rounded-lg border border-border/40 bg-surface/60 p-3 space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-foreground/40">
          Funding Rate
        </p>
        <div className="flex items-end justify-between">
          <span
            className={clsx(
              "text-lg font-mono font-semibold",
              rate > 0 ? "text-bullish" : rate < 0 ? "text-bearish" : "text-foreground/60"
            )}
          >
            {formatRate(rate)}
          </span>
          <span className="text-[10px] font-mono text-foreground/40">/ 8h</span>
        </div>
        <div className="flex items-center justify-between border-t border-border/30 pt-1.5">
          <span className="text-[10px] font-mono text-foreground/40">Next in</span>
          <span className="text-[10px] font-mono text-foreground/60">
            {formatTime(funding?.next_funding_time ?? 0)}
          </span>
        </div>

        {/* Open Interest */}
        {oi && oi.open_interest > 0 && (
          <div className="flex items-center justify-between border-t border-border/30 pt-1.5">
            <span className="text-[10px] font-mono text-foreground/40 uppercase tracking-wider">
              Open Int.
            </span>
            <span className="text-[10px] font-mono text-foreground/70">
              {fmtOI(oi.open_interest)}
            </span>
          </div>
        )}
      </div>

      {/* Liquidations */}
      <div className="rounded-lg border border-border/40 bg-surface/60 p-3 space-y-2 flex-1 min-h-0">
        <p className="text-[10px] font-mono uppercase tracking-widest text-foreground/40">
          Liquidations
        </p>
        <div className="space-y-0.5 overflow-y-auto max-h-52">
          {liquidations.length === 0 ? (
            <p className="text-[10px] font-mono text-foreground/30 py-2 text-center">
              No recent liquidations
            </p>
          ) : (
            liquidations.map((liq, i) => {
              const usdValue = liq.size * liq.price;
              const isLarge = usdValue >= 100_000;
              return (
                <div
                  key={i}
                  className={clsx(
                    "flex items-center justify-between py-0.5 rounded px-1",
                    isLarge && (liq.side === "buy" ? "bg-bullish/8" : "bg-bearish/8")
                  )}
                >
                  <span
                    className={clsx(
                      "text-[10px] font-mono font-semibold uppercase",
                      liq.side === "buy" ? "text-bullish" : "text-bearish"
                    )}
                  >
                    {liq.side === "buy" ? "LONG" : "SHORT"}
                  </span>
                  <span className={clsx(
                    "text-[10px] font-mono",
                    isLarge ? "text-foreground/80 font-semibold" : "text-foreground/60"
                  )}>
                    {fmtUsd(usdValue)}
                  </span>
                  <span className="text-[10px] font-mono text-foreground/40">
                    @{liq.price.toLocaleString()}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
