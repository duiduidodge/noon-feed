"use client";

import { useEffect, useRef } from "react";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let destroyed = false;

    (async () => {
      // Wait one frame so CSS flex/absolute layout is fully computed
      await new Promise<void>((r) => { requestAnimationFrame(() => r()); });
      if (destroyed || !containerRef.current) return;

      const el = containerRef.current;
      // offsetWidth/offsetHeight are reliable for absolutely-positioned elements
      const w = el.offsetWidth || window.innerWidth;
      const h = el.offsetHeight || Math.floor(window.innerHeight * 0.65);

      const { createChart, ColorType, CrosshairMode } = await import(
        "lightweight-charts"
      );
      if (destroyed || !containerRef.current) return;

      const chart = createChart(el, {
        width: w,
        height: h,
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
          vertLine: {
            color: "hsl(142 52% 60% / 0.4)",
            labelBackgroundColor: "hsl(150 14% 8%)",
          },
          horzLine: {
            color: "hsl(142 52% 60% / 0.4)",
            labelBackgroundColor: "hsl(150 14% 8%)",
          },
        },
        rightPriceScale: { borderColor: "hsl(150 10% 16%)" },
        timeScale: {
          borderColor: "hsl(150 10% 16%)",
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: true,
        handleScale: true,
      });

      const series = chart.addCandlestickSeries({
        upColor: "hsl(142 72% 46%)",
        downColor: "hsl(0 78% 54%)",
        borderUpColor: "hsl(142 72% 46%)",
        borderDownColor: "hsl(0 78% 54%)",
        wickUpColor: "hsl(142 72% 46%)",
        wickDownColor: "hsl(0 78% 54%)",
      });

      seriesRef.current = series;

      // Keep chart sized to container
      const ro = new ResizeObserver(() => {
        if (!containerRef.current) return;
        chart.applyOptions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      });
      ro.observe(el);

      // Fetch seed candles
      const base = (
        process.env.NEXT_PUBLIC_CHARTS_API_URL ?? "http://localhost:8080"
      )
        .replace(/^wss:\/\//, "https://")
        .replace(/^ws:\/\//, "http://");

      fetch(`${base}/candles/${coin}?tf=${timeframe}&limit=200`)
        .then((r) => r.json())
        .then((data: CandleMsg[]) => {
          if (!destroyed && Array.isArray(data) && data.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            series.setData(data as any);
            chart.timeScale().fitContent();
          }
        })
        .catch((err) => console.error("[CandleChart] fetch:", err));

      cleanupRef.current = () => {
        ro.disconnect();
        chart.remove();
        seriesRef.current = null;
      };
    })();

    return () => {
      destroyed = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin, timeframe]);

  // Push live candle updates
  useEffect(() => {
    if (!seriesRef.current || !latestCandle) return;
    try {
      seriesRef.current.update(latestCandle);
    } catch { /* series may not be ready */ }
  }, [latestCandle]);

  // Container is absolutely positioned — parent must be position:relative
  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: "8px" }}
    />
  );
}

export default CandleChart;
