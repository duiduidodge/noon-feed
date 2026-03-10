/**
 * Server-side candlestick chart renderer using @napi-rs/canvas.
 * Produces a PNG buffer for Discord embed + vision LLM analysis.
 * Includes Smart Money Concepts overlays: FVG, Order Blocks, BOS/CHoCH, Swing points.
 */

import { createCanvas } from '@napi-rs/canvas';
import {
  swingHighsLows,
  fairValueGaps,
  orderBlocks,
  breakOfStructure,
} from './smart-money-concepts.js';

interface KlineData {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  vols: number[];
}

interface PivotLevels {
  s1?: number;
  pp?: number;
  r1?: number;
}

interface ChartOptions {
  asset: string;
  direction: 'LONG' | 'SHORT';
  klines4h: KlineData;
  ema20?: number[];
  ema50?: number[];
  pivots?: PivotLevels | null;
  support?: number | null;
  resistance?: number | null;
}

const WIDTH = 800;
const HEIGHT = 500;
const PADDING = { top: 40, right: 80, bottom: 50, left: 10 };
const CHART_W = WIDTH - PADDING.left - PADDING.right;
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;

const COLORS = {
  bg: '#1a1a2e',
  grid: '#2a2a4a',
  text: '#8888aa',
  bullCandle: '#00c853',
  bearCandle: '#e53935',
  bullWick: '#00c853',
  bearWick: '#e53935',
  ema20: '#ffab40',
  ema50: '#42a5f5',
  pivotPP: '#ffffff44',
  pivotS1: '#e5393544',
  pivotR1: '#00c85344',
  support: '#4caf5066',
  resistance: '#f4433666',
  longArrow: '#00c853',
  shortArrow: '#e53935',
  volume: '#ffffff18',
  // Smart Money Concepts
  fvgBull: 'rgba(0, 200, 83, 0.12)',
  fvgBear: 'rgba(229, 57, 53, 0.12)',
  fvgBullBorder: 'rgba(0, 200, 83, 0.35)',
  fvgBearBorder: 'rgba(229, 57, 53, 0.35)',
  obBull: 'rgba(0, 188, 212, 0.15)',
  obBear: 'rgba(171, 71, 188, 0.15)',
  obBullBorder: 'rgba(0, 188, 212, 0.45)',
  obBearBorder: 'rgba(171, 71, 188, 0.45)',
  swingHigh: '#ffffff88',
  swingLow: '#ffffff88',
  bos: '#00e5ff',
  choch: '#ffd740',
};

function calculateEma(closes: number[], period: number): number[] {
  const result: number[] = [];
  if (closes.length === 0) return result;
  const alpha = 2 / (period + 1);
  result.push(closes[0]);
  for (let i = 1; i < closes.length; i++) {
    result.push(closes[i] * alpha + result[i - 1] * (1 - alpha));
  }
  return result;
}

export async function renderChartImage(options: ChartOptions): Promise<Buffer> {
  const { asset, direction, klines4h, pivots, support, resistance } = options;
  const { opens, highs, lows, closes, vols } = klines4h;

  // Use last 60 candles
  const n = Math.min(60, opens.length);
  const startIdx = opens.length - n;
  const o = opens.slice(startIdx);
  const h = highs.slice(startIdx);
  const l = lows.slice(startIdx);
  const c = closes.slice(startIdx);
  const v = vols.slice(startIdx);

  // Compute EMAs from full data, then slice
  const ema20Full = options.ema20 ?? calculateEma(closes, 20);
  const ema50Full = options.ema50 ?? calculateEma(closes, 50);
  const ema20 = ema20Full.slice(startIdx);
  const ema50 = ema50Full.slice(startIdx);

  // Price range
  const allPrices = [...h, ...l];
  if (pivots?.s1) allPrices.push(pivots.s1);
  if (pivots?.r1) allPrices.push(pivots.r1);
  if (support) allPrices.push(support);
  if (resistance) allPrices.push(resistance);
  const priceMin = Math.min(...allPrices);
  const priceMax = Math.max(...allPrices);
  const pricePad = (priceMax - priceMin) * 0.05;
  const yMin = priceMin - pricePad;
  const yMax = priceMax + pricePad;

  const volMax = Math.max(...v, 1);

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Helper: price → y coordinate
  const priceToY = (price: number) => PADDING.top + CHART_H * (1 - (price - yMin) / (yMax - yMin));
  const candleW = Math.max(2, Math.floor(CHART_W / n * 0.7));
  const candleGap = CHART_W / n;
  const candleX = (i: number) => PADDING.left + i * candleGap + (candleGap - candleW) / 2;

  // Grid lines (5 horizontal)
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 0.5;
  ctx.font = '11px monospace';
  ctx.fillStyle = COLORS.text;
  for (let i = 0; i <= 4; i++) {
    const y = PADDING.top + (CHART_H / 4) * i;
    const price = yMax - (yMax - yMin) * (i / 4);
    ctx.beginPath();
    ctx.moveTo(PADDING.left, y);
    ctx.lineTo(WIDTH - PADDING.right, y);
    ctx.stroke();
    // Price label on right
    const label = price >= 1000 ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}` :
                  price >= 1 ? `$${price.toFixed(2)}` : `$${price.toFixed(5)}`;
    ctx.fillText(label, WIDTH - PADDING.right + 5, y + 4);
  }

  // Volume bars (bottom 20% of chart)
  const volHeight = CHART_H * 0.15;
  ctx.fillStyle = COLORS.volume;
  for (let i = 0; i < n; i++) {
    const barH = (v[i] / volMax) * volHeight;
    const x = candleX(i);
    ctx.fillRect(x, PADDING.top + CHART_H - barH, candleW, barH);
  }

  // ── Smart Money Concepts overlays ──────────────────────────────────────────
  // Compute SMC on the visible slice
  const smcOhlc = { opens: o, highs: h, lows: l, closes: c, vols: v };
  const swings = swingHighsLows(smcOhlc, 5);
  const fvgs = fairValueGaps(smcOhlc);
  const obs = orderBlocks(smcOhlc, swings);
  const bosChoch = breakOfStructure(smcOhlc, swings);

  // Helper: draw a horizontal zone rectangle spanning candle indices
  const drawZone = (
    fromIdx: number, toIdx: number,
    top: number, bottom: number,
    fillColor: string, borderColor: string,
  ) => {
    const x1 = candleX(Math.max(0, fromIdx));
    const x2 = candleX(Math.min(n - 1, toIdx)) + candleW;
    const y1 = priceToY(top);
    const y2 = priceToY(bottom);
    ctx.fillStyle = fillColor;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 0.7;
    ctx.setLineDash([]);
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  };

  // Fair Value Gaps — extend from creation to mitigation (or chart edge)
  for (const fvg of fvgs) {
    if (fvg.index >= n) continue;
    const endIdx = fvg.mitigatedIndex >= 0 && fvg.mitigatedIndex < n
      ? fvg.mitigatedIndex : n - 1;
    if (fvg.direction === 1) {
      drawZone(fvg.index, endIdx, fvg.top, fvg.bottom, COLORS.fvgBull, COLORS.fvgBullBorder);
    } else {
      drawZone(fvg.index, endIdx, fvg.top, fvg.bottom, COLORS.fvgBear, COLORS.fvgBearBorder);
    }
  }

  // Order Blocks — only show unmitigated ones (active zones)
  for (const ob of obs) {
    if (ob.index >= n || ob.mitigated) continue;
    // Extend OB zone to right edge of chart (they persist until mitigated)
    if (ob.direction === 1) {
      drawZone(ob.index, n - 1, ob.top, ob.bottom, COLORS.obBull, COLORS.obBullBorder);
    } else {
      drawZone(ob.index, n - 1, ob.top, ob.bottom, COLORS.obBear, COLORS.obBearBorder);
    }
    // Label
    ctx.fillStyle = ob.direction === 1 ? COLORS.obBullBorder : COLORS.obBearBorder;
    ctx.font = '9px monospace';
    ctx.fillText(ob.direction === 1 ? 'OB+' : 'OB-', candleX(ob.index) + 2, priceToY(ob.top) - 2);
  }

  // Break of Structure / Change of Character — dashed line at the broken level
  for (const brk of bosChoch) {
    if (brk.index >= n) continue;
    const y = priceToY(brk.level);
    if (y < PADDING.top || y > PADDING.top + CHART_H) continue;
    const color = brk.type === 'BOS' ? COLORS.bos : COLORS.choch;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    const x1 = candleX(Math.max(0, brk.index - 8));
    const x2 = candleX(Math.min(n - 1, brk.index + 3)) + candleW;
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.setLineDash([]);
    // Label
    ctx.fillStyle = color;
    ctx.font = 'bold 9px monospace';
    const label = `${brk.type} ${brk.direction === 1 ? '\u25B2' : '\u25BC'}`;
    ctx.fillText(label, x2 + 2, y + 3);
  }

  // Swing High/Low markers — small diamonds
  for (let si = 0; si < swings.indices.length; si++) {
    const idx = swings.indices[si];
    if (idx >= n) continue;
    const isSH = swings.directions[si] === 1;
    const price = swings.levels[si];
    const cx = candleX(idx) + candleW / 2;
    const cy = priceToY(price) + (isSH ? -6 : 6);
    ctx.fillStyle = isSH ? COLORS.swingHigh : COLORS.swingLow;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 3);
    ctx.lineTo(cx + 3, cy);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx - 3, cy);
    ctx.closePath();
    ctx.fill();
  }

  // Pivot lines
  const drawHLine = (price: number, color: string, label: string) => {
    if (price < yMin || price > yMax) return;
    const y = priceToY(price);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(PADDING.left, y);
    ctx.lineTo(WIDTH - PADDING.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color.replace(/44$/, 'aa');
    ctx.font = '10px monospace';
    ctx.fillText(label, PADDING.left + 3, y - 3);
  };

  if (pivots?.pp) drawHLine(pivots.pp, COLORS.pivotPP, 'PP');
  if (pivots?.s1) drawHLine(pivots.s1, COLORS.pivotS1, 'S1');
  if (pivots?.r1) drawHLine(pivots.r1, COLORS.pivotR1, 'R1');
  if (support) drawHLine(support, COLORS.support, 'Support');
  if (resistance) drawHLine(resistance, COLORS.resistance, 'Resistance');

  // EMA lines
  const drawLine = (data: number[], color: string) => {
    if (data.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === undefined || isNaN(data[i])) continue;
      const x = candleX(i) + candleW / 2;
      const y = priceToY(data[i]);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  drawLine(ema20, COLORS.ema20);
  drawLine(ema50, COLORS.ema50);

  // Candlesticks
  for (let i = 0; i < n; i++) {
    const isBull = c[i] >= o[i];
    const bodyTop = priceToY(Math.max(o[i], c[i]));
    const bodyBot = priceToY(Math.min(o[i], c[i]));
    const wickTop = priceToY(h[i]);
    const wickBot = priceToY(l[i]);
    const x = candleX(i);
    const midX = x + candleW / 2;

    // Wick
    ctx.strokeStyle = isBull ? COLORS.bullWick : COLORS.bearWick;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(midX, wickTop);
    ctx.lineTo(midX, wickBot);
    ctx.stroke();

    // Body
    ctx.fillStyle = isBull ? COLORS.bullCandle : COLORS.bearCandle;
    const bodyH = Math.max(1, bodyBot - bodyTop);
    ctx.fillRect(x, bodyTop, candleW, bodyH);
  }

  // Direction arrow on the last candle
  const lastX = candleX(n - 1) + candleW / 2 + 15;
  const lastPrice = c[n - 1];
  const arrowY = priceToY(lastPrice);
  ctx.fillStyle = direction === 'LONG' ? COLORS.longArrow : COLORS.shortArrow;
  ctx.beginPath();
  if (direction === 'LONG') {
    ctx.moveTo(lastX, arrowY - 12);
    ctx.lineTo(lastX - 6, arrowY);
    ctx.lineTo(lastX + 6, arrowY);
  } else {
    ctx.moveTo(lastX, arrowY + 12);
    ctx.lineTo(lastX - 6, arrowY);
    ctx.lineTo(lastX + 6, arrowY);
  }
  ctx.fill();

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px monospace';
  const dirIcon = direction === 'LONG' ? '\u25B2' : '\u25BC';
  ctx.fillText(`${asset}/USDT  4H  ${dirIcon} ${direction}`, PADDING.left + 5, 25);

  // Legend — top right
  ctx.font = '10px monospace';
  ctx.fillStyle = COLORS.ema20;
  ctx.fillText('EMA20', WIDTH - PADDING.right - 120, 25);
  ctx.fillStyle = COLORS.ema50;
  ctx.fillText('EMA50', WIDTH - PADDING.right - 60, 25);

  // SMC legend — bottom bar
  ctx.fillStyle = COLORS.text;
  ctx.font = '9px monospace';
  let legendX = PADDING.left + 5;
  ctx.fillText(`Last ${n} candles (4H)`, legendX, HEIGHT - 10);
  legendX += 130;
  ctx.fillStyle = COLORS.obBullBorder;
  ctx.fillText('OB', legendX, HEIGHT - 10);
  legendX += 25;
  ctx.fillStyle = COLORS.fvgBullBorder;
  ctx.fillText('FVG', legendX, HEIGHT - 10);
  legendX += 30;
  ctx.fillStyle = COLORS.bos;
  ctx.fillText('BOS', legendX, HEIGHT - 10);
  legendX += 30;
  ctx.fillStyle = COLORS.choch;
  ctx.fillText('CHoCH', legendX, HEIGHT - 10);

  return Buffer.from(canvas.toBuffer('image/png'));
}
