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

export function CandleChart({ coin, timeframe, latestCandle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts")["createChart"]> | null>(null);
  const seriesRef = useRef<unknown>(null);
  const initedRef = useRef(false);

  // Init chart once per coin/timeframe
  useEffect(() => {
    if (initedRef.current) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    // Defer one frame so CSS layout is fully computed before reading dimensions
    const raf = requestAnimationFrame(() => {
      if (cancelled || !containerRef.current) return;

      const container = containerRef.current;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 500;

      import("lightweight-charts").then(({ createChart, ColorType, CrosshairMode }) => {
        if (cancelled || !containerRef.current) return;

        const chart = createChart(container, {
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
            vertLine: { color: "hsl(142 52% 60% / 0.4)", labelBackgroundColor: "hsl(150 14% 8%)" },
            horzLine: { color: "hsl(142 52% 60% / 0.4)", labelBackgroundColor: "hsl(150 14% 8%)" },
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

        chartRef.current = chart;
        seriesRef.current = series;
        initedRef.current = true;

        // Resize observer — keep chart size in sync with container
        const ro = new ResizeObserver(() => {
          if (!containerRef.current) return;
          chart.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        });
        ro.observe(container);

        // Load seed candles
        const apiBase =
          process.env.NEXT_PUBLIC_CHARTS_API_URL?.replace(/^wss?:\/\//, "https://") ??
          "http://localhost:8080";
        fetch(`${apiBase}/candles/${coin}?tf=${timeframe}&limit=200`)
          .then((r) => r.json())
          .then((data: CandleMsg[]) => {
            if (Array.isArray(data) && data.length > 0) {
              series.setData(
                data as unknown as Parameters<typeof series.setData>[0]
              );
              chart.timeScale().fitContent();
            }
          })
          .catch((err) => console.error("[CandleChart] seed fetch failed:", err));

        cleanup = () => {
          ro.disconnect();
          chart.remove();
          initedRef.current = false;
          chartRef.current = null;
          seriesRef.current = null;
        };
      }).catch((err) => console.error("[CandleChart] import failed:", err));
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cleanup?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin, timeframe]);

  // Push live candle updates
  useEffect(() => {
    if (!seriesRef.current || !latestCandle) return;
    try {
      (seriesRef.current as { update: (d: CandleMsg) => void }).update(latestCandle);
    } catch { /* series may not be ready */ }
  }, [latestCandle]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
