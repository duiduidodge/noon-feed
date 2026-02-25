"use client";

import { useEffect, useRef } from "react";
import type { CandleMsg } from "@/hooks/useChartStream";
import type { Timeframe } from "./TimeframeSelector";
import type { Coin } from "./CoinSelector";

const COIN_COLORS: Record<Coin, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  SOL: "#9945ff",
  XRP: "#346aa9",
};

type Props = {
  coin: Coin;
  timeframe: Timeframe;
  latestCandle: CandleMsg | null;
};

export function CandleChart({ coin, timeframe, latestCandle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts")["createChart"]> | null>(null);
  const seriesRef = useRef<unknown>(null);
  const initedRef = useRef(false);

  // Init chart once
  useEffect(() => {
    if (!containerRef.current || initedRef.current) return;

    let cleanup: (() => void) | undefined;

    import("lightweight-charts").then(({ createChart, ColorType, CrosshairMode }) => {
      if (!containerRef.current) return;

      const w = containerRef.current.clientWidth || 800;
      const h = containerRef.current.clientHeight || 500;

      const chart = createChart(containerRef.current, {
        width: w,
        height: h,
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: "hsl(150 14% 6%)" },
          textColor: "hsl(120 18% 60%)",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "hsl(150 10% 11%)" },
          horzLines: { color: "hsl(150 10% 11%)" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "hsl(142 52% 60% / 0.4)", labelBackgroundColor: "hsl(150 14% 8%)" },
          horzLine: { color: "hsl(142 52% 60% / 0.4)", labelBackgroundColor: "hsl(150 14% 8%)" },
        },
        rightPriceScale: {
          borderColor: "hsl(150 10% 16%)",
        },
        timeScale: {
          borderColor: "hsl(150 10% 16%)",
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: true,
        handleScale: true,
      });

      const accentColor = COIN_COLORS[coin];
      const series = chart.addCandlestickSeries({
        upColor: "hsl(142 72% 46%)",
        downColor: "hsl(0 78% 54%)",
        borderUpColor: "hsl(142 72% 46%)",
        borderDownColor: "hsl(0 78% 54%)",
        wickUpColor: "hsl(142 72% 46%)",
        wickDownColor: "hsl(0 78% 54%)",
      });

      chartRef.current = chart;
      seriesRef.current = series;
      initedRef.current = true;

      // Load seed candles
      const apiBase = process.env.NEXT_PUBLIC_CHARTS_API_URL?.replace(/^wss?/, "http") ?? "http://localhost:8080";
      fetch(`${apiBase}/candles/${coin}?tf=${timeframe}&limit=200`)
        .then((r) => r.json())
        .then((data: CandleMsg[]) => {
          if (Array.isArray(data) && data.length > 0) {
            series.setData(data as unknown as Parameters<typeof series.setData>[0]);
            chart.timeScale().fitContent();
          }
        })
        .catch(() => {});

      cleanup = () => {
        chart.remove();
        initedRef.current = false;
        chartRef.current = null;
        seriesRef.current = null;
      };
    });

    return () => cleanup?.();
  // Reinit when coin or timeframe changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin, timeframe]);

  // Push live candle updates
  useEffect(() => {
    if (!seriesRef.current || !latestCandle) return;
    try {
      (seriesRef.current as { update: (d: CandleMsg) => void }).update(latestCandle);
    } catch { /* series may not be ready */ }
  }, [latestCandle]);

  return <div ref={containerRef} className="w-full h-full" />;
}
