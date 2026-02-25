"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import type { CandleMsg } from "@/hooks/useChartStream";
import type { Timeframe } from "./TimeframeSelector";
import type { Coin } from "./CoinSelector";
import { calcSMA, calcEMA, calcRSI, type OHLCPoint, type IndicatorConfig } from "@/lib/indicators";

type Props = {
  coin: Coin;
  timeframe: Timeframe;
  latestCandle: CandleMsg | null;
  indicators: IndicatorConfig[];
  showRSI: boolean;
};

const BULL_COLOR = "#22c55e";
const BEAR_COLOR = "#ef4444";
const BULL_VOL   = "rgba(34,197,94,0.35)";
const BEAR_VOL   = "rgba(239,68,68,0.35)";

const CHART_THEME = {
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
  rightPriceScale: { borderColor: "#1e2b1f" },
  timeScale: { borderColor: "#1e2b1f", timeVisible: true, secondsVisible: false },
};

function calcIndicatorPoints(config: IndicatorConfig, data: OHLCPoint[]) {
  return config.type === "sma" ? calcSMA(data, config.period) : calcEMA(data, config.period);
}

function CandleChart({ coin, timeframe, latestCandle, indicators, showRSI }: Props) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);

  const chartRef    = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volSeriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rsiSeriesRef = useRef<any>(null);

  // Dynamic MA/EMA series — keyed by IndicatorConfig.id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

  // Keep latest candle data accessible to effects without re-running the main effect
  const candleDataRef = useRef<OHLCPoint[]>([]);

  // Keep latest indicators accessible inside the fetch callback
  const currentIndicatorsRef = useRef(indicators);
  currentIndicatorsRef.current = indicators;

  const syncingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState("mounting…");

  // ── Main chart + RSI init (reruns on coin/timeframe change only) ────────
  useEffect(() => {
    let destroyed = false;
    setStatus("rAF pending…");

    const rafId = requestAnimationFrame(() => {
      if (destroyed) return;
      if (!containerRef.current || !rsiContainerRef.current) {
        setStatus("no container ref");
        return;
      }

      const el    = containerRef.current;
      const rsiEl = rsiContainerRef.current;
      const w = el.offsetWidth  || window.innerWidth;
      const h = el.offsetHeight || Math.floor(window.innerHeight * 0.6);
      setStatus(`${w}×${h} — creating chart…`);

      // ── Main chart ──────────────────────────────────────────────────────
      let chart: IChartApi;
      try {
        chart = createChart(el, {
          ...CHART_THEME,
          width: w, height: h,
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: { color: "rgba(82,186,100,0.4)", labelBackgroundColor: "#0d1410" },
            horzLine: { color: "rgba(82,186,100,0.4)", labelBackgroundColor: "#0d1410" },
          },
          handleScroll: true,
          handleScale:  true,
        });
      } catch (err) {
        setStatus(`createChart error: ${err}`);
        return;
      }

      // Candlestick
      const series = chart.addCandlestickSeries({
        upColor: BULL_COLOR, downColor: BEAR_COLOR,
        borderUpColor: BULL_COLOR, borderDownColor: BEAR_COLOR,
        wickUpColor: BULL_COLOR, wickDownColor: BEAR_COLOR,
      });

      // Volume histogram
      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      chart.priceScale("vol").applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });

      // ── RSI chart ───────────────────────────────────────────────────────
      const rsiChart = createChart(rsiEl, {
        ...CHART_THEME,
        width:  rsiEl.offsetWidth  || w,
        height: rsiEl.offsetHeight || 120,
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "rgba(82,186,100,0.3)", labelBackgroundColor: "#0d1410" },
          horzLine: { color: "rgba(82,186,100,0.3)", labelBackgroundColor: "#0d1410" },
        },
        handleScroll: true,
        handleScale:  false,
        rightPriceScale: {
          borderColor: "#1e2b1f",
          scaleMargins: { top: 0.1, bottom: 0.1 },
          autoScale: false,
        },
        timeScale: { borderColor: "#1e2b1f", timeVisible: false, secondsVisible: false },
        leftPriceScale: { visible: false },
      });

      const rsiSeries = rsiChart.addLineSeries({
        color: "#d946ef",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
      });
      for (const { price, color } of [
        { price: 70, color: "rgba(239,68,68,0.5)"  },
        { price: 30, color: "rgba(34,197,94,0.5)"  },
        { price: 50, color: "rgba(255,255,255,0.15)" },
      ]) {
        rsiSeries.createPriceLine({ price, color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "" });
      }

      // ── Time range sync ─────────────────────────────────────────────────
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (syncingRef.current || !range) return;
        syncingRef.current = true;
        rsiChart.timeScale().setVisibleLogicalRange(range);
        syncingRef.current = false;
      });
      rsiChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (syncingRef.current || !range) return;
        syncingRef.current = true;
        chart.timeScale().setVisibleLogicalRange(range);
        syncingRef.current = false;
      });

      // ── Assign refs ─────────────────────────────────────────────────────
      chartRef.current     = chart;
      rsiChartRef.current  = rsiChart;
      seriesRef.current    = series;
      volSeriesRef.current = volSeries;
      rsiSeriesRef.current = rsiSeries;

      // ── ResizeObserver ───────────────────────────────────────────────────
      const ro = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width:  containerRef.current.offsetWidth,
            height: containerRef.current.offsetHeight,
          });
        }
        if (rsiContainerRef.current && rsiChartRef.current) {
          rsiChartRef.current.applyOptions({
            width:  rsiContainerRef.current.offsetWidth,
            height: rsiContainerRef.current.offsetHeight,
          });
        }
      });
      ro.observe(el);
      ro.observe(rsiEl);

      // ── Fetch historical candles ─────────────────────────────────────────
      const base = (process.env.NEXT_PUBLIC_CHARTS_API_URL ?? "http://localhost:8080")
        .replace(/^wss:\/\//, "https://")
        .replace(/^ws:\/\//, "http://");

      setStatus(`fetching ${coin}…`);

      fetch(`${base}/candles/${coin}?tf=${timeframe}&limit=300`)
        .then((r) => r.json())
        .then((data: OHLCPoint[]) => {
          if (destroyed || !seriesRef.current) return;
          if (!Array.isArray(data) || data.length === 0) {
            setStatus("fetch ok but empty");
            return;
          }

          // Candles + volume
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          seriesRef.current.setData(data as any);
          volSeriesRef.current?.setData(
            data.map((c) => ({
              time: c.time, value: c.volume,
              color: c.close >= c.open ? BULL_VOL : BEAR_VOL,
            }))
          );

          // RSI
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rsiSeriesRef.current?.setData(calcRSI(data, 14) as any);
          rsiChart.priceScale("right").applyOptions({ autoScale: true });

          // Store candle data for indicator effects
          candleDataRef.current = data;

          // Build all current indicator series
          for (const config of currentIndicatorsRef.current) {
            const pts = calcIndicatorPoints(config, data);
            const s = chart.addLineSeries({
              color: config.color,
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            s.setData(pts as any);
            indicatorSeriesRef.current.set(config.id, s);
          }

          chartRef.current?.timeScale().fitContent();
          setStatus("");
        })
        .catch((err) => setStatus(`fetch error: ${err}`));

      cleanupRef.current = () => {
        ro.disconnect();
        chart.remove();
        rsiChart.remove();
        chartRef.current     = null;
        rsiChartRef.current  = null;
        seriesRef.current    = null;
        volSeriesRef.current = null;
        rsiSeriesRef.current = null;
        indicatorSeriesRef.current.clear();
        candleDataRef.current = [];
        cleanupRef.current    = null;
      };
    });

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      cleanupRef.current?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin, timeframe]);

  // ── Dynamic indicator series (add/remove/update periods) ────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const data  = candleDataRef.current;
    if (!chart || data.length === 0) return;

    const existing = indicatorSeriesRef.current;
    const newIds = new Set(indicators.map((i) => i.id));

    // Remove deleted indicators
    for (const [id, s] of [...existing]) {
      if (!newIds.has(id)) {
        try { chart.removeSeries(s); } catch { /* already gone */ }
        existing.delete(id);
      }
    }

    // Add new or update existing
    for (const config of indicators) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pts = calcIndicatorPoints(config, data) as any;
      if (existing.has(config.id)) {
        const s = existing.get(config.id)!;
        s.setData(pts);
        s.applyOptions({ color: config.color });
      } else {
        const s = chart.addLineSeries({
          color: config.color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        s.setData(pts);
        existing.set(config.id, s);
      }
    }
  }, [indicators]);

  // ── Live candle updates ─────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || !latestCandle) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seriesRef.current.update(latestCandle as any);
      volSeriesRef.current?.update({
        time: latestCandle.time, value: latestCandle.volume,
        color: latestCandle.close >= latestCandle.open ? BULL_VOL : BEAR_VOL,
      });
    } catch { /* not ready */ }
  }, [latestCandle]);

  // ── RSI chart height when toggled ───────────────────────────────────────
  useEffect(() => {
    if (!rsiChartRef.current || !rsiContainerRef.current) return;
    rsiChartRef.current.applyOptions({
      width:  rsiContainerRef.current.offsetWidth,
      height: rsiContainerRef.current.offsetHeight || 120,
    });
  }, [showRSI]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, width: "100%" }} />

      {/* RSI pane — height animated via CSS */}
      <div
        ref={rsiContainerRef}
        style={{
          width: "100%",
          height: showRSI ? 120 : 0,
          overflow: "hidden",
          transition: "height 0.2s ease",
          borderTop: showRSI ? "1px solid #1e2b1f" : "none",
        }}
      />

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
