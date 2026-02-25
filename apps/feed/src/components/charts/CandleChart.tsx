"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
} from "lightweight-charts";
import type { CandleMsg } from "@/hooks/useChartStream";
import type { Timeframe } from "./TimeframeSelector";
import type { Coin } from "./CoinSelector";

type Props = {
  coin: Coin;
  timeframe: Timeframe;
  latestCandle: CandleMsg | null;
};

function CandleChart({ coin, timeframe, latestCandle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let destroyed = false;

    // One rAF so flex/absolute layout is fully measured before we read dimensions
    const rafId = requestAnimationFrame(() => {
      if (destroyed || !containerRef.current) return;

      const el = containerRef.current;
      const w = el.offsetWidth  || window.innerWidth;
      const h = el.offsetHeight || Math.floor(window.innerHeight * 0.6);

      console.log("[CandleChart] init", w, h);

      const chart = createChart(el, {
        width: w,
        height: h,
        layout: {
          background: { type: ColorType.Solid, color: "hsl(150, 14%, 8%)" },
          textColor: "hsl(120, 18%, 70%)",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "hsl(150, 10%, 13%)" },
          horzLines: { color: "hsl(150, 10%, 13%)" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "hsla(142, 52%, 60%, 0.5)", labelBackgroundColor: "hsl(150, 14%, 10%)" },
          horzLine: { color: "hsla(142, 52%, 60%, 0.5)", labelBackgroundColor: "hsl(150, 14%, 10%)" },
        },
        rightPriceScale: { borderColor: "hsl(150, 10%, 20%)" },
        timeScale: {
          borderColor: "hsl(150, 10%, 20%)",
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: true,
        handleScale: true,
      });

      const series = chart.addCandlestickSeries({
        upColor:         "hsl(142, 72%, 46%)",
        downColor:       "hsl(0, 78%, 54%)",
        borderUpColor:   "hsl(142, 72%, 46%)",
        borderDownColor: "hsl(0, 78%, 54%)",
        wickUpColor:     "hsl(142, 72%, 46%)",
        wickDownColor:   "hsl(0, 78%, 54%)",
      });

      chartRef.current  = chart;
      seriesRef.current = series;

      // Keep chart sized to container on window resize
      const ro = new ResizeObserver(() => {
        if (!containerRef.current || !chartRef.current) return;
        chartRef.current.applyOptions({
          width:  containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      });
      ro.observe(el);

      // Fetch seed candles
      const base = (process.env.NEXT_PUBLIC_CHARTS_API_URL ?? "http://localhost:8080")
        .replace(/^wss:\/\//, "https://")
        .replace(/^ws:\/\//, "http://");

      fetch(`${base}/candles/${coin}?tf=${timeframe}&limit=200`)
        .then((r) => r.json())
        .then((data: CandleMsg[]) => {
          console.log("[CandleChart] seed data", data?.length ?? 0);
          if (destroyed || !seriesRef.current) return;
          if (Array.isArray(data) && data.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            seriesRef.current.setData(data as any);
            chartRef.current?.timeScale().fitContent();
          }
        })
        .catch((err) => console.error("[CandleChart] fetch error:", err));

      cleanupRef.current = () => {
        ro.disconnect();
        chart.remove();
        chartRef.current  = null;
        seriesRef.current = null;
        cleanupRef.current = null;
      };
    });

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      cleanupRef.current?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin, timeframe]);

  // Push live candle updates
  useEffect(() => {
    if (!seriesRef.current || !latestCandle) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seriesRef.current.update(latestCandle as any);
    } catch { /* series not ready */ }
  }, [latestCandle]);

  // This div is absolutely positioned — parent must have position:relative
  return <div ref={containerRef} style={{ position: "absolute", inset: "8px" }} />;
}

export default CandleChart;
