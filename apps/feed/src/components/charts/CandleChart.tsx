"use client";

import { useEffect, useRef, useState } from "react";
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
  const [status, setStatus] = useState("mounting…");

  useEffect(() => {
    let destroyed = false;
    setStatus("rAF pending…");

    const rafId = requestAnimationFrame(() => {
      if (destroyed) { setStatus("destroyed before rAF"); return; }
      if (!containerRef.current) { setStatus("no container ref"); return; }

      const el = containerRef.current;
      const w = el.offsetWidth  || window.innerWidth;
      const h = el.offsetHeight || Math.floor(window.innerHeight * 0.6);
      setStatus(`el ${w}×${h} — creating chart…`);

      let chart: IChartApi;
      try {
        chart = createChart(el, {
          width: w,
          height: h,
          layout: {
            background: { type: ColorType.Solid, color: "#111a14" },
            textColor: "#a3bda3",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11,
          },
          grid: {
            vertLines: { color: "#1c231e" },
            horzLines: { color: "#1c231e" },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: { color: "rgba(82,186,100,0.5)", labelBackgroundColor: "#101810" },
            horzLine: { color: "rgba(82,186,100,0.5)", labelBackgroundColor: "#101810" },
          },
          rightPriceScale: { borderColor: "#2b3530" },
          timeScale: { borderColor: "#2b3530", timeVisible: true, secondsVisible: false },
          handleScroll: true,
          handleScale: true,
        });
      } catch (err) {
        setStatus(`createChart error: ${err}`);
        return;
      }

      const series = chart.addCandlestickSeries({
        upColor:         "#22c55e",
        downColor:       "#ef4444",
        borderUpColor:   "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor:     "#22c55e",
        wickDownColor:   "#ef4444",
      });

      chartRef.current  = chart;
      seriesRef.current = series;

      const ro = new ResizeObserver(() => {
        if (!containerRef.current || !chartRef.current) return;
        chartRef.current.applyOptions({
          width:  containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      });
      ro.observe(el);

      const base = (process.env.NEXT_PUBLIC_CHARTS_API_URL ?? "http://localhost:8080")
        .replace(/^wss:\/\//, "https://")
        .replace(/^ws:\/\//, "http://");

      setStatus(`fetching ${base}/candles/${coin}…`);

      fetch(`${base}/candles/${coin}?tf=${timeframe}&limit=200`)
        .then((r) => r.json())
        .then((data: CandleMsg[]) => {
          if (destroyed || !seriesRef.current) return;
          if (Array.isArray(data) && data.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            seriesRef.current.setData(data as any);
            chartRef.current?.timeScale().fitContent();
            setStatus(""); // clear — chart is ready
          } else {
            setStatus(`fetch ok but empty (${JSON.stringify(data).slice(0, 60)})`);
          }
        })
        .catch((err) => setStatus(`fetch error: ${err}`));

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

  useEffect(() => {
    if (!seriesRef.current || !latestCandle) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seriesRef.current.update(latestCandle as any);
    } catch { /* not ready */ }
  }, [latestCandle]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {status && (
        <div style={{
          position: "absolute", top: 8, left: 8, zIndex: 10,
          background: "rgba(0,0,0,0.75)", color: "#4ade80",
          fontFamily: "monospace", fontSize: 11, padding: "4px 8px",
          borderRadius: 4, pointerEvents: "none",
          maxWidth: "90%", wordBreak: "break-all",
        }}>
          {status}
        </div>
      )}
    </div>
  );
}

export default CandleChart;
