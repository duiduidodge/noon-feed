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

const CandleChart = dynamic(() => import("@/components/charts/CandleChart"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#4a7a4a" }}>
        loading chart…
      </span>
    </div>
  ),
});

const MAX_TRADES       = 40;
const MAX_LIQUIDATIONS = 30;

function useStreamState(coin: Coin) {
  const [latestCandle, setLatestCandle] = useState<CandleMsg | null>(null);
  const [trades, setTrades]             = useState<TradeMsg[]>([]);
  const [book, setBook]                 = useState<BookMsg | null>(null);
  const [funding, setFunding]           = useState<FundingMsg | null>(null);
  const [oi, setOI]                     = useState<OIMsg | null>(null);
  const [liquidations, setLiquidations] = useState<LiquidationMsg[]>([]);

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

function fmtPrice(price: number | null): string {
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

  // Derive current price — latest trade is most reactive
  const currentPrice = useMemo(
    () => trades[0]?.price ?? latestCandle?.close ?? null,
    [trades, latestCandle]
  );

  // Price direction from last 2 trades
  const priceDir: "up" | "down" | "flat" = useMemo(() => {
    if (!trades[0] || !trades[1]) return "flat";
    if (trades[0].price > trades[1].price) return "up";
    if (trades[0].price < trades[1].price) return "down";
    return "flat";
  }, [trades]);

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] md:h-[calc(100dvh-108px)] bg-background text-foreground overflow-hidden">

      {/* ── Controls bar ─────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border/25 shrink-0 bg-background/80">
        {/* Coin tabs */}
        <CoinSelector selected={coin} onChange={setCoin} />

        {/* Divider */}
        <div className="h-4 w-px bg-border/30" />

        {/* Live price */}
        <div className="flex items-baseline gap-1.5">
          <span
            className={clsx(
              "text-lg font-mono font-bold tabular-nums leading-none transition-colors duration-150",
              priceDir === "up"   ? "text-bullish" :
              priceDir === "down" ? "text-bearish"  : "text-foreground"
            )}
          >
            {fmtPrice(currentPrice)}
          </span>
          {priceDir !== "flat" && (
            <span className={clsx(
              "text-[11px] font-mono leading-none",
              priceDir === "up" ? "text-bullish/70" : "text-bearish/70"
            )}>
              {priceDir === "up" ? "▲" : "▼"}
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Timeframe */}
        <TimeframeSelector selected={timeframe} onChange={setTimeframe} />

        {/* Divider */}
        <div className="h-4 w-px bg-border/30" />

        {/* Connection pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/50">
          <div className={clsx(
            "w-1.5 h-1.5 rounded-full transition-colors",
            connected ? "bg-bullish animate-pulse" : "bg-foreground/20"
          )} />
          <span className="text-[9px] font-mono uppercase tracking-widest text-foreground/40">
            {connected ? "Live" : "…"}
          </span>
        </div>
      </div>

      {/* ── Main layout ──────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Chart column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 relative" style={{ minHeight: "300px" }}>
            <CandleChart
              coin={coin}
              timeframe={timeframe}
              latestCandle={latestCandle}
            />
          </div>
          <TradesPanel trades={trades} />
        </div>

        {/* Right panel */}
        <div className="w-[220px] shrink-0 border-l border-border/25 flex flex-col gap-2 p-2 overflow-y-auto bg-background/30">
          <OrderBookPanel book={book} />
          <FundingPanel funding={funding} oi={oi} liquidations={liquidations} />
        </div>
      </div>
    </div>
  );
}
