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
import type { IndicatorKey } from "./IndicatorSelector";
import { calcSMA, calcEMA, calcRSI, type OHLCPoint } from "@/lib/indicators";

type Props = {
  coin: Coin;
  timeframe: Timeframe;
  latestCandle: CandleMsg | null;
  indicators: Set<IndicatorKey>;
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

const MA_COLORS: Record<IndicatorKey, string> = {
  ma20:  "#f59e0b",
  ma50:  "#8b5cf6",
  ma200: "#3b82f6",
  ema9:  "#06b6d4",
  ema21: "#f97316",
  rsi14: "#d946ef",
};

function CandleChart({ coin, timeframe, latestCandle, indicators }: Props) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);

  const chartRef    = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volSeriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maSeriesRef  = useRef<Record<IndicatorKey, any>>({} as Record<IndicatorKey, any>);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rsiSeriesRef = useRef<any>(null);

  const syncingRef   = useRef(false);
  const cleanupRef   = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState("mounting…");
  const showRSI = indicators.has("rsi14");

  // ── Main chart + RSI chart init ─────────────────────────────────────────
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

      // ── Main chart ──
      let chart: IChartApi;
      try {
        chart = createChart(el, {
          ...CHART_THEME,
          width:  w,
          height: h,
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

      // Volume
      const volSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      chart.priceScale("vol").applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });

      // MA/EMA line series
      const maKeys: IndicatorKey[] = ["ma20", "ma50", "ma200", "ema9", "ema21"];
      const maSeries: Record<string, ISeriesApi<"Line">> = {};
      for (const key of maKeys) {
        maSeries[key] = chart.addLineSeries({
          color:           MA_COLORS[key],
          lineWidth:       key === "ma200" ? 2 : 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          visible: false, // will be set after data load
        });
      }

      // ── RSI chart ──
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
          minimumWidth: 60,
        },
        timeScale: { borderColor: "#1e2b1f", timeVisible: false, secondsVisible: false },
        leftPriceScale: { visible: false },
      });
      rsiChart.priceScale("right").applyOptions({ autoScale: false });

      const rsiSeries = rsiChart.addLineSeries({
        color: MA_COLORS["rsi14"],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
      });

      // RSI reference lines
      for (const { price, color } of [
        { price: 70, color: "rgba(239,68,68,0.5)" },
        { price: 30, color: "rgba(34,197,94,0.5)" },
        { price: 50, color: "rgba(255,255,255,0.15)" },
      ]) {
        rsiSeries.createPriceLine({
          price,
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "",
        });
      }

      // ── Time range sync ──
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

      chartRef.current    = chart;
      rsiChartRef.current = rsiChart;
      seriesRef.current   = series;
      volSeriesRef.current = volSeries;
      maSeriesRef.current  = maSeries as Record<IndicatorKey, ISeriesApi<"Line">>;
      rsiSeriesRef.current = rsiSeries;

      // ── ResizeObserver ──
      const ro = new ResizeObserver(() => {
        if (!containerRef.current || !chartRef.current) return;
        chartRef.current.applyOptions({
          width:  containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
        if (!rsiContainerRef.current || !rsiChartRef.current) return;
        rsiChartRef.current.applyOptions({
          width:  rsiContainerRef.current.offsetWidth,
          height: rsiContainerRef.current.offsetHeight,
        });
      });
      ro.observe(el);
      ro.observe(rsiEl);

      // ── Fetch historical candles ──
      const base = (process.env.NEXT_PUBLIC_CHARTS_API_URL ?? "http://localhost:8080")
        .replace(/^wss:\/\//, "https://")
        .replace(/^ws:\/\//, "http://");

      setStatus(`fetching ${coin}…`);

      fetch(`${base}/candles/${coin}?tf=${timeframe}&limit=300`)
        .then((r) => r.json())
        .then((data: OHLCPoint[]) => {
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

            // Compute + set MA/EMA
            const calcs: Record<string, ReturnType<typeof calcSMA>> = {
              ma20:  calcSMA(data, 20),
              ma50:  calcSMA(data, 50),
              ma200: calcSMA(data, 200),
              ema9:  calcEMA(data, 9),
              ema21: calcEMA(data, 21),
            };
            for (const key of maKeys) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              maSeriesRef.current[key]?.setData(calcs[key] as any);
              maSeriesRef.current[key]?.applyOptions({
                visible: indicators.has(key),
              });
            }

            // RSI
            const rsiData = calcRSI(data, 14);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rsiSeriesRef.current?.setData(rsiData as any);
            if (rsiData.length > 0) {
              rsiChart.priceScale("right").applyOptions({ autoScale: true });
            }

            chartRef.current?.timeScale().fitContent();
            setStatus("");
          } else {
            setStatus(`fetch ok but empty`);
          }
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
        maSeriesRef.current  = {} as Record<IndicatorKey, ISeriesApi<"Line">>;
        rsiSeriesRef.current = null;
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

  // ── Toggle MA/EMA visibility when indicators prop changes ───────────────
  useEffect(() => {
    const maKeys: IndicatorKey[] = ["ma20", "ma50", "ma200", "ema9", "ema21"];
    for (const key of maKeys) {
      maSeriesRef.current[key]?.applyOptions({ visible: indicators.has(key) });
    }
  }, [indicators]);

  // ── Live candle updates ─────────────────────────────────────────────────
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
      {/* Main chart */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, width: "100%" }} />

      {/* RSI pane */}
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

      {/* Status overlay */}
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
