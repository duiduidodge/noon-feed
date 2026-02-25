"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import type { CandleMsg } from "@/hooks/useChartStream";
import type { Timeframe } from "./TimeframeSelector";
import type { Coin } from "./CoinSelector";

type Props = {
  coin: Coin;
  timeframe: Timeframe;
  latestCandle: CandleMsg | null;
};

const BULL_COLOR = "#22c55e";
const BEAR_COLOR = "#ef4444";
const BULL_VOL   = "rgba(34,197,94,0.35)";
const BEAR_VOL   = "rgba(239,68,68,0.35)";

function CandleChart({ coin, timeframe, latestCandle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volSeriesRef = useRef<any>(null);
  const cleanupRef   = useRef<(() => void) | null>(null);
  const [status, setStatus]   = useState("mounting…");

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
            background: { type: ColorType.Solid, color: "#0d1410" },
            textColor: "#7fa07f",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11,
          },
          grid: {
            vertLines: { color: "#161e17" },
            horzLines: { color: "#161e17" },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: { color: "rgba(82,186,100,0.4)", labelBackgroundColor: "#0d1410" },
            horzLine: { color: "rgba(82,186,100,0.4)", labelBackgroundColor: "#0d1410" },
          },
          rightPriceScale: { borderColor: "#1e2b1f" },
          timeScale: {
            borderColor: "#1e2b1f",
            timeVisible: true,
            secondsVisible: false,
          },
          handleScroll: true,
          handleScale: true,
        });
      } catch (err) {
        setStatus(`createChart error: ${err}`);
        return;
      }

      const series = chart.addCandlestickSeries({
        upColor:         BULL_COLOR,
        downColor:       BEAR_COLOR,
        borderUpColor:   BULL_COLOR,
        borderDownColor: BEAR_COLOR,
        wickUpColor:     BULL_COLOR,
        wickDownColor:   BEAR_COLOR,
      });

      // Volume histogram — overlaid in the bottom 18% of the chart
      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      chart.priceScale("vol").applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });

      chartRef.current    = chart;
      seriesRef.current   = series;
      volSeriesRef.current = volSeries;

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

      setStatus(`fetching ${coin}…`);

      fetch(`${base}/candles/${coin}?tf=${timeframe}&limit=300`)
        .then((r) => r.json())
        .then((data: CandleMsg[]) => {
          if (destroyed || !seriesRef.current) return;
          if (Array.isArray(data) && data.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            seriesRef.current.setData(data as any);
            volSeriesRef.current?.setData(
              data.map((c) => ({
                time:  c.time,
                value: c.volume,
                color: c.close >= c.open ? BULL_VOL : BEAR_VOL,
              }))
            );
            chartRef.current?.timeScale().fitContent();
            setStatus(""); // clear — chart is ready
          } else {
            setStatus(`fetch ok but empty`);
          }
        })
        .catch((err) => setStatus(`fetch error: ${err}`));

      cleanupRef.current = () => {
        ro.disconnect();
        chart.remove();
        chartRef.current     = null;
        seriesRef.current    = null;
        volSeriesRef.current = null;
        cleanupRef.current   = null;
      };
    });

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      cleanupRef.current?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin, timeframe]);

  // Live candle updates
  useEffect(() => {
    if (!seriesRef.current || !latestCandle) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seriesRef.current.update(latestCandle as any);
      volSeriesRef.current?.update({
        time:  latestCandle.time,
        value: latestCandle.volume,
        color: latestCandle.close >= latestCandle.open ? BULL_VOL : BEAR_VOL,
      });
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
