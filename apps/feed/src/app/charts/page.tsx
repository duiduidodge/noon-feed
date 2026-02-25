"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { CoinSelector, type Coin } from "@/components/charts/CoinSelector";
import { TimeframeSelector, type Timeframe } from "@/components/charts/TimeframeSelector";
import { TradesPanel } from "@/components/charts/TradesPanel";
import { OrderBookPanel } from "@/components/charts/OrderBookPanel";
import { FundingPanel } from "@/components/charts/FundingPanel";
import { useChartStream } from "@/hooks/useChartStream";
import type { CandleMsg, TradeMsg, BookMsg, FundingMsg, LiquidationMsg, OIMsg } from "@/hooks/useChartStream";
import clsx from "clsx";

// Load chart only on client — lightweight-charts is browser-only
const CandleChart = dynamic(() => import("@/components/charts/CandleChart"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "monospace", fontSize: 11, color: "hsl(120 18% 40%)" }}>
        loading chart…
      </span>
    </div>
  ),
});

const MAX_TRADES       = 40;
const MAX_LIQUIDATIONS = 30;

function useStreamState(coin: Coin) {
  const [latestCandle, setLatestCandle]   = useState<CandleMsg | null>(null);
  const [trades, setTrades]               = useState<TradeMsg[]>([]);
  const [book, setBook]                   = useState<BookMsg | null>(null);
  const [funding, setFunding]             = useState<FundingMsg | null>(null);
  const [oi, setOI]                       = useState<OIMsg | null>(null);
  const [liquidations, setLiquidations]   = useState<LiquidationMsg[]>([]);

  const { connected } = useChartStream(coin, {
    onCandle:      useCallback((c: CandleMsg) => setLatestCandle(c), []),
    onTrade:       useCallback((t: TradeMsg) => {
      setTrades((prev) => {
        const next = [t, ...prev];
        return next.length > MAX_TRADES ? next.slice(0, MAX_TRADES) : next;
      });
    }, []),
    onBook:        useCallback((b: BookMsg) => setBook(b), []),
    onFunding:     useCallback((f: FundingMsg) => setFunding(f), []),
    onOI:          useCallback((o: OIMsg) => setOI(o), []),
    onLiquidation: useCallback((l: LiquidationMsg) => {
      setLiquidations((prev) => {
        const next = [l, ...prev];
        return next.length > MAX_LIQUIDATIONS ? next.slice(0, MAX_LIQUIDATIONS) : next;
      });
    }, []),
  });

  return { latestCandle, trades, book, funding, oi, liquidations, connected };
}

function fmtCurrentPrice(price: number | null): string {
  if (!price) return "—";
  if (price >= 10000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 100)   return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return price.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export default function ChartsPage() {
  const [coin, setCoin]           = useState<Coin>("BTC");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");

  const { latestCandle, trades, book, funding, oi, liquidations, connected } =
    useStreamState(coin);

  // Derive current price from latest trade (most responsive) or latest candle close
  const currentPrice = useMemo(
    () => trades[0]?.price ?? latestCandle?.close ?? null,
    [trades, latestCandle]
  );

  // Track previous price for direction indicator
  const prevPrice = trades[1]?.price ?? null;
  const priceDir  = currentPrice && prevPrice
    ? currentPrice > prevPrice ? "up" : currentPrice < prevPrice ? "down" : "flat"
    : "flat";

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] md:h-[calc(100dvh-108px)] bg-background text-foreground overflow-hidden">
      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 shrink-0 gap-3">
        <CoinSelector selected={coin} onChange={setCoin} />

        {/* Current price */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={clsx(
              "text-base font-mono font-semibold tabular-nums transition-colors",
              priceDir === "up"   ? "text-bullish" :
              priceDir === "down" ? "text-bearish"  : "text-foreground/80"
            )}
          >
            {fmtCurrentPrice(currentPrice)}
          </span>
          {priceDir !== "flat" && (
            <span className={clsx(
              "text-[11px] font-mono",
              priceDir === "up" ? "text-bullish" : "text-bearish"
            )}>
              {priceDir === "up" ? "▲" : "▼"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <TimeframeSelector selected={timeframe} onChange={setTimeframe} />

          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <div
              className={clsx(
                "w-1.5 h-1.5 rounded-full transition-colors",
                connected ? "bg-bullish animate-pulse" : "bg-bearish/60"
              )}
            />
            <span className="text-[10px] font-mono text-foreground/30">
              {connected ? "live" : "connecting"}
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Chart area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Chart container */}
          <div className="flex-1" style={{ minHeight: "300px", overflow: "hidden" }}>
            <CandleChart
              coin={coin}
              timeframe={timeframe}
              latestCandle={latestCandle}
            />
          </div>
          <TradesPanel trades={trades} />
        </div>

        {/* Right panel */}
        <div className="w-56 shrink-0 border-l border-border/30 flex flex-col gap-2 p-2 overflow-y-auto">
          <OrderBookPanel book={book} />
          <FundingPanel funding={funding} oi={oi} liquidations={liquidations} />
        </div>
      </div>
    </div>
  );
}
