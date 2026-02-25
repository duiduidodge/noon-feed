"use client";

import { useState, useCallback } from "react";
import { CoinSelector, type Coin } from "@/components/charts/CoinSelector";
import { TimeframeSelector, type Timeframe } from "@/components/charts/TimeframeSelector";
import { CandleChart } from "@/components/charts/CandleChart";
import { TradesPanel } from "@/components/charts/TradesPanel";
import { OrderBookPanel } from "@/components/charts/OrderBookPanel";
import { FundingPanel } from "@/components/charts/FundingPanel";
import { useChartStream } from "@/hooks/useChartStream";
import type { CandleMsg, TradeMsg, BookMsg, FundingMsg, LiquidationMsg } from "@/hooks/useChartStream";
import clsx from "clsx";

const MAX_TRADES = 40;
const MAX_LIQUIDATIONS = 30;

function useStreamState(coin: Coin) {
  const [latestCandle, setLatestCandle] = useState<CandleMsg | null>(null);
  const [trades, setTrades] = useState<TradeMsg[]>([]);
  const [book, setBook] = useState<BookMsg | null>(null);
  const [funding, setFunding] = useState<FundingMsg | null>(null);
  const [liquidations, setLiquidations] = useState<LiquidationMsg[]>([]);

  const { connected } = useChartStream(coin, {
    onCandle: useCallback((c: CandleMsg) => setLatestCandle(c), []),
    onTrade: useCallback((t: TradeMsg) => {
      setTrades((prev) => {
        const next = [t, ...prev];
        return next.length > MAX_TRADES ? next.slice(0, MAX_TRADES) : next;
      });
    }, []),
    onBook: useCallback((b: BookMsg) => setBook(b), []),
    onFunding: useCallback((f: FundingMsg) => setFunding(f), []),
    onLiquidation: useCallback((l: LiquidationMsg) => {
      setLiquidations((prev) => {
        const next = [l, ...prev];
        return next.length > MAX_LIQUIDATIONS ? next.slice(0, MAX_LIQUIDATIONS) : next;
      });
    }, []),
  });

  return { latestCandle, trades, book, funding, liquidations, connected };
}

export default function ChartsPage() {
  const [coin, setCoin] = useState<Coin>("BTC");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");

  const { latestCandle, trades, book, funding, liquidations, connected } =
    useStreamState(coin);

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] md:h-[calc(100dvh-108px)] bg-background text-foreground overflow-hidden">
      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 shrink-0">
        <CoinSelector selected={coin} onChange={setCoin} />
        <div className="flex items-center gap-3">
          <TimeframeSelector selected={timeframe} onChange={setTimeframe} />
          {/* Connection indicator */}
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
          <div className="flex-1 min-h-0 relative">
            <div className="absolute inset-0 p-2">
              <CandleChart
                coin={coin}
                timeframe={timeframe}
                latestCandle={latestCandle}
              />
            </div>
          </div>
          {/* Trades ticker */}
          <TradesPanel trades={trades} />
        </div>

        {/* Right panel */}
        <div className="w-56 shrink-0 border-l border-border/30 flex flex-col gap-2 p-2 overflow-y-auto">
          <OrderBookPanel book={book} />
          <FundingPanel funding={funding} liquidations={liquidations} />
        </div>
      </div>
    </div>
  );
}
