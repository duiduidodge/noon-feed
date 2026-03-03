/**
 * Opportunity Scanner — TypeScript port of scripts/opportunity-scan.py
 * Uses Binance Futures public APIs only (no API key required).
 * Produces the same JSON schema as OpportunitySnapshot / OpportunitySignal.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = 'https://fapi.binance.com';
const MIN_VOLUME_USDT = 60_000_000;
const STAGE1_LIMIT = 60;
const DEEP_LIMIT = 10;
const TOP_OUTPUT = 6;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_CONCURRENT = 8;

// Quality gates — signals must pass ALL of these to be emitted
const MIN_SCORE = 270;               // Minimum absolute score (out of 400)
const MIN_SCAN_STREAK = 2;           // Must appear in N consecutive scans
const MAX_FUNDING_ANNUALIZED = 100;  // % — hard veto for extremely crowded longs

const EXCLUDE_SYMBOLS = new Set([
  'USDCUSDT', 'BUSDUSDT', 'TUSDUSDT', 'USDTUSDT', 'DAIUSDT',
  'BTCDOMUSDT', 'DEFIUSDT', 'ALTUSDT',
]);
const EXCLUDE_SUFFIXES = ['BULL', 'BEAR', 'UP', 'DOWN', '3L', '3S', '5L', '5S'];

// State file: prefer OPPORTUNITY_STATE_FILE env var, else project artifacts dir, else /tmp
function resolveStateFile(): string {
  if (process.env.OPPORTUNITY_STATE_FILE) return process.env.OPPORTUNITY_STATE_FILE;
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(here, '../../../..');
    const artifactsDir = path.join(projectRoot, 'artifacts');
    if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
    return path.join(artifactsDir, '.opportunity-state.json');
  } catch {
    return path.join(os.tmpdir(), '.opportunity-state.json');
  }
}

const STATE_FILE = resolveStateFile();

// ─── Types ────────────────────────────────────────────────────────────────────

interface KlineData {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  vols: number[];
}

interface TickerRow {
  symbol: string;
  quoteVolume: string;
  lastPrice: string;
  priceChangePercent: string;
}

interface ScanState {
  [symbol: string]: { finalScore: number; scanStreak: number };
}

interface PivotPoints {
  pp: number;
  s1: number;
  r1: number;
  s2: number;
  r2: number;
}

export interface OpportunityResult {
  asset: string;
  direction: string;
  leverage: number;
  finalScore: number;
  scoreDelta: number;
  scanStreak: number;
  hourlyTrend: string;
  trendAligned: boolean;
  pillarScores: { smartMoney: number; marketStructure: number; technicals: number; funding: number };
  smartMoney: { traders: number; pnlPct: number; accel: number; direction: string };
  technicals: {
    rsi1h: number; rsi15m: number | null; volRatio1h: number; volRatio15m: number | null;
    trend4h: string; trend1h: string; trendStrength: number; patterns1h: string[]; patterns15m: string[];
    momentum15m: number | null; chg1h: number; chg4h: number; chg24h: number;
    support: number | null; resistance: number | null; pivots: PivotPoints | null; atrPct: number;
  };
  funding: { rate: number; annualized: number; favorable: boolean };
  risks: string[];
}

export interface OpportunityScanResult {
  scanTime: string;
  assetsScanned: number;
  passedStage1: number;
  passedStage2: number;
  deepDived: number;
  disqualified: number;
  filteredByGates: number;
  btcContext: { price: number; trend: string; trend4h: string; change1h: number; change24h: number };
  opportunities: OpportunityResult[];
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function getJson<T>(
  url: string,
  params?: Record<string, string | number>,
  retries = 2
): Promise<T | null> {
  const qs = params ? '?' + new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString() : '';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(url + qs, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch {
      if (attempt < retries) await sleep(300 * (attempt + 1));
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Technical indicators ─────────────────────────────────────────────────────

function calculateRsi(closes: number[], period = 14): number {
  if (closes.length < period + 2) return 50;
  const deltas = closes.slice(1).map((c, i) => c - closes[i]);
  const gains = deltas.map((d) => Math.max(d, 0));
  const losses = deltas.map((d) => Math.max(-d, 0));
  let avgG = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgL = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < deltas.length; i++) {
    avgG = (avgG * (period - 1) + gains[i]) / period;
    avgL = (avgL * (period - 1) + losses[i]) / period;
  }
  if (avgL === 0) return 100;
  return Math.round((100 - 100 / (1 + avgG / avgL)) * 100) / 100;
}

function calculateEma(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] ?? 0;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (const price of closes.slice(period)) ema = price * k + ema * (1 - k);
  return ema;
}

function calculateAtrPct(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < 2) return 1;
  const trs: number[] = [];
  for (let i = 1; i < Math.min(closes.length, period + 1); i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  const atr = trs.reduce((a, b) => a + b, 0) / (trs.length || 1);
  const price = closes[closes.length - 1];
  return price > 0 ? Math.round((atr / price) * 100 * 1000) / 1000 : 1;
}

function volumeRatio(vols: number[]): number {
  if (vols.length < 3) return 1;
  const baseline = vols.slice(0, -1).slice(-20);
  const avg = baseline.reduce((a, b) => a + b, 0) / (baseline.length || 1);
  return avg > 0 ? Math.round((vols[vols.length - 1] / avg) * 100) / 100 : 1;
}

function detectPatterns(
  closes: number[], opens: number[], highs: number[], lows: number[]
): string[] {
  const patterns: string[] = [];
  if (closes.length < 5) return patterns;
  const n = closes.length;

  if (highs[n - 1] > highs[n - 3] && lows[n - 1] > lows[n - 3]) patterns.push('higher_highs');
  else if (highs[n - 1] < highs[n - 3] && lows[n - 1] < lows[n - 3]) patterns.push('lower_lows');

  const ranges = [1, 2, 3].map((i) => closes[n - i] > 0 ? (highs[n - i] - lows[n - i]) / closes[n - i] : 0);
  if (ranges.reduce((a, b) => a + b, 0) / ranges.length < 0.005) patterns.push('consolidation');

  if (closes.length >= 2) {
    const prevBody = Math.abs(closes[n - 2] - opens[n - 2]);
    const currBody = Math.abs(closes[n - 1] - opens[n - 1]);
    if (closes[n - 1] > opens[n - 1] && opens[n - 1] < closes[n - 2]
        && closes[n - 1] > opens[n - 2] && currBody > prevBody) patterns.push('bull_engulf');
    else if (closes[n - 1] < opens[n - 1] && opens[n - 1] > closes[n - 2]
             && closes[n - 1] < opens[n - 2] && currBody > prevBody) patterns.push('bear_engulf');
  }
  return patterns;
}

// Classic pivot points from the last COMPLETE candle (index n-2, not n-1 which may be in-progress)
function calculatePivotPoints(highs: number[], lows: number[], closes: number[]): PivotPoints | null {
  if (highs.length < 2) return null;
  const i = highs.length - 2; // last complete candle
  const high = highs[i];
  const low = lows[i];
  const close = closes[i];
  const pp = (high + low + close) / 3;
  const p = 1_000_000;
  return {
    pp: Math.round(pp * p) / p,
    s1: Math.round(((2 * pp) - high) * p) / p,
    r1: Math.round(((2 * pp) - low) * p) / p,
    s2: Math.round((pp - (high - low)) * p) / p,
    r2: Math.round((pp + (high - low)) * p) / p,
  };
}

// ─── Binance API fetchers ─────────────────────────────────────────────────────

async function fetchKlines(symbol: string, interval: string, limit: number): Promise<KlineData | null> {
  const data = await getJson<unknown[][]>(`${BASE_URL}/fapi/v1/klines`, { symbol, interval, limit });
  if (!data || !Array.isArray(data)) return null;
  return {
    opens:  data.map((k) => parseFloat(k[1] as string)),
    highs:  data.map((k) => parseFloat(k[2] as string)),
    lows:   data.map((k) => parseFloat(k[3] as string)),
    closes: data.map((k) => parseFloat(k[4] as string)),
    vols:   data.map((k) => parseFloat(k[5] as string)),
  };
}

async function fetchTopLongShort(symbol: string): Promise<number | null> {
  const data = await getJson<Array<{ longShortRatio: string }>>(
    `${BASE_URL}/futures/data/topLongShortPositionRatio`,
    { symbol, period: '1h', limit: 3 }
  );
  if (!data || !data.length) return null;
  const val = parseFloat(data[data.length - 1].longShortRatio);
  return isNaN(val) ? null : val;
}

async function fetchTakerRatio(symbol: string): Promise<number | null> {
  const data = await getJson<Array<{ buySellRatio: string }>>(
    `${BASE_URL}/futures/data/takerlongshortRatio`,
    { symbol, period: '1h', limit: 3 }
  );
  if (!data || !data.length) return null;
  const val = parseFloat(data[data.length - 1].buySellRatio);
  return isNaN(val) ? null : val;
}

async function fetchOiChange(symbol: string): Promise<number | null> {
  const data = await getJson<Array<{ sumOpenInterestValue: string }>>(
    `${BASE_URL}/futures/data/openInterestHist`,
    { symbol, period: '1h', limit: 5 }
  );
  if (!data || data.length < 2) return null;
  const oldest = parseFloat(data[0].sumOpenInterestValue);
  const newest = parseFloat(data[data.length - 1].sumOpenInterestValue);
  if (isNaN(oldest) || isNaN(newest) || oldest === 0) return null;
  return Math.round((newest - oldest) / oldest * 100 * 100) / 100;
}

async function fetchFundingRate(symbol: string): Promise<number | null> {
  const data = await getJson<{ lastFundingRate?: string }>(
    `${BASE_URL}/fapi/v1/premiumIndex`,
    { symbol }
  );
  if (!data?.lastFundingRate) return null;
  const val = parseFloat(data.lastFundingRate);
  return isNaN(val) ? null : val;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scorePillars(
  direction: string, rsi1h: number | null, rsi15m: number | null,
  trend4h: string, volR: number | null, oiChg: number | null,
  topLs: number | null, takerR: number | null, fundingRate: number | null,
  chg1h: number // needed for OI/price divergence check
): { sm: number; ms: number; tech: number; fund: number; risks: string[]; favorable: boolean; annualized: number; hardVeto: boolean } {
  const risks: string[] = [];
  let hardVeto = false;

  // ── Smart Money ──────────────────────────────────────────────────────────────
  let sm = 50;
  if (topLs !== null) {
    const ratio = direction === 'LONG' ? topLs : (topLs > 0 ? 1 / topLs : 1);
    if (ratio >= 2.0) sm = 85;
    else if (ratio >= 1.5) sm = 75;
    else if (ratio >= 1.2) sm = 65;
    else if (ratio >= 1.0) sm = 55;
    else if (ratio >= 0.8) sm = 40;
    else sm = 30;
  }
  if (takerR !== null) {
    const goodTaker = (direction === 'LONG' && takerR > 1.1) || (direction === 'SHORT' && takerR < 0.9);
    if (goodTaker) sm = Math.min(100, sm + 10);
  }

  // ── Market Structure (with OI/price divergence) ───────────────────────────
  let ms = 50;
  if (trend4h === 'UP') ms = direction === 'LONG' ? 68 : 35;
  else if (trend4h === 'DOWN') ms = direction === 'SHORT' ? 68 : 35;

  if (oiChg !== null) {
    if (oiChg > 5) {
      const priceAligned =
        (direction === 'LONG' && chg1h > 0) ||
        (direction === 'SHORT' && chg1h < 0);
      const priceDiverges =
        (direction === 'LONG' && chg1h < 0) ||
        (direction === 'SHORT' && chg1h > 0);

      if (priceAligned) {
        // OI rising + price moving with direction = confirmed accumulation
        ms = Math.min(100, ms + 15);
      } else if (priceDiverges) {
        // OI rising but price moving against direction = distribution signal
        ms = Math.max(0, ms - 20);
        risks.push('oi_price_divergence');
      } else {
        ms = Math.min(100, ms + 5);
      }
    } else if (oiChg > 2) {
      ms = Math.min(100, ms + 8);
    } else if (oiChg < -5) {
      ms = Math.max(0, ms - 15);
    }
  }
  if (volR !== null && volR > 1.5) ms = Math.min(100, ms + 8);

  // ── Technicals ────────────────────────────────────────────────────────────
  let tech = 50;
  if (rsi1h !== null) {
    if (direction === 'LONG') {
      if (rsi1h >= 45 && rsi1h <= 65) tech = 72;
      else if (rsi1h >= 30 && rsi1h < 45) tech = 78;
      else if (rsi1h < 30) tech = 62;
      else if (rsi1h > 75) { tech = 32; risks.push('overbought_rsi'); }
      else tech = 55;
    } else {
      if (rsi1h >= 55 && rsi1h <= 72) tech = 72;
      else if (rsi1h > 72) tech = 78;
      else if (rsi1h < 30) { tech = 32; risks.push('oversold_rsi'); }
      else tech = 55;
    }
  }
  if (rsi15m !== null) {
    const good15m = (direction === 'LONG' && rsi15m >= 45 && rsi15m <= 70)
                 || (direction === 'SHORT' && rsi15m >= 55 && rsi15m <= 75);
    if (good15m) tech = Math.min(100, tech + 8);
  }
  if (volR !== null) {
    if (volR >= 2.5) tech = Math.min(100, tech + 15);
    else if (volR >= 1.5) tech = Math.min(100, tech + 8);
    else if (volR < 0.6) { tech = Math.max(0, tech - 15); risks.push('low_volume'); }
  }

  // ── Funding ───────────────────────────────────────────────────────────────
  let fund = 50;
  let favorable = false;
  let annualized = 0;
  if (fundingRate !== null) {
    annualized = Math.round(fundingRate * 3 * 365 * 100 * 100) / 100;

    if (direction === 'LONG') {
      // Hard veto: extremely crowded long — funding above threshold is unsustainable
      if (annualized > MAX_FUNDING_ANNUALIZED) {
        hardVeto = true;
        risks.push('extreme_funding');
      } else if (fundingRate < -0.0002) { fund = 90; favorable = true; }
      else if (fundingRate < 0) { fund = 75; favorable = true; }
      else if (fundingRate < 0.0002) fund = 55;
      else if (fundingRate < 0.001) fund = 40;
      else { fund = 25; risks.push('high_funding'); }
    } else {
      if (fundingRate > 0.0002) { fund = 90; favorable = true; }
      else if (fundingRate > 0) { fund = 75; favorable = true; }
      else if (fundingRate > -0.0002) fund = 55;
      else fund = 30;
    }
  }

  return { sm, ms, tech, fund, risks, favorable, annualized, hardVeto };
}

// Returns null if 1H and 4H trends conflict — asset should be skipped
function chooseDirection(
  rsi1h: number | null, trend4h: string, trend1h: string,
  topLs: number | null, takerR: number | null
): 'LONG' | 'SHORT' | null {
  // Timeframe agreement required: both non-FLAT trends must point the same way
  if (trend4h !== 'FLAT' && trend1h !== 'FLAT' && trend4h !== trend1h) {
    return null; // Conflicting 1H/4H trends — skip this asset
  }

  let longV = 0, shortV = 0;
  // 4H carries more weight (longer timeframe = more reliable)
  if (trend4h === 'UP') longV += 2;
  else if (trend4h === 'DOWN') shortV += 2;
  // 1H adds confirmation
  if (trend1h === 'UP') longV += 1;
  else if (trend1h === 'DOWN') shortV += 1;
  // RSI context
  if (rsi1h !== null) {
    if (rsi1h < 40) longV++;
    else if (rsi1h > 65) shortV++;
  }
  // Smart money positioning
  if (topLs !== null) {
    if (topLs > 1.2) longV++;
    else if (topLs < 0.8) shortV++;
  }
  // Taker pressure
  if (takerR !== null) {
    if (takerR > 1.1) longV++;
    else if (takerR < 0.9) shortV++;
  }
  return longV >= shortV ? 'LONG' : 'SHORT';
}

function recommendLeverage(atrPct: number): number {
  if (atrPct > 3) return 3;
  if (atrPct > 2) return 5;
  if (atrPct > 1) return 8;
  return 10;
}

// ─── State persistence ────────────────────────────────────────────────────────

function loadState(): ScanState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as ScanState;
  } catch {
    return {};
  }
}

function saveState(state: ScanState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8');
  } catch { /* best effort */ }
}

// ─── Per-asset deep analysis ──────────────────────────────────────────────────

async function analyzeAsset(
  symbol: string,
  ticker: TickerRow,
  prevState: ScanState
): Promise<(OpportunityResult & { _symbol: string; _finalScore: number }) | null> {
  try {
    const [klines1h, klines4h, klines15m] = await Promise.all([
      fetchKlines(symbol, '1h', 52),
      fetchKlines(symbol, '4h', 55), // 55 candles for EMA50 + pivot point from previous candle
      fetchKlines(symbol, '15m', 35),
    ]);

    if (!klines1h) return null;

    const { opens: o1h, highs: h1h, lows: l1h, closes: c1h, vols: v1h } = klines1h;

    const [topLs, takerR, oiChg, fundingRate] = await Promise.all([
      fetchTopLongShort(symbol),
      fetchTakerRatio(symbol),
      fetchOiChange(symbol),
      fetchFundingRate(symbol),
    ]);

    const rsi1h = calculateRsi(c1h);
    const rsi15m = klines15m ? calculateRsi(klines15m.closes) : null;
    const volR = volumeRatio(v1h);
    const volR15m = klines15m ? volumeRatio(klines15m.vols) : null;
    const atrPct = calculateAtrPct(h1h, l1h, c1h);

    // 4H trend: EMA20 vs EMA50
    let trend4h = 'FLAT';
    let trendStrength = 50;
    if (klines4h && klines4h.closes.length >= 20) {
      const c4h = klines4h.closes;
      const ema20 = calculateEma(c4h, 20);
      const ema50 = calculateEma(c4h, Math.min(50, c4h.length));
      const curr = c4h[c4h.length - 1];
      if (curr > ema20 && ema20 > ema50) {
        trend4h = 'UP';
        trendStrength = Math.min(100, Math.round((curr - ema50) / ema50 * 4000));
      } else if (curr < ema20 && ema20 < ema50) {
        trend4h = 'DOWN';
        trendStrength = Math.min(100, Math.round((ema50 - curr) / ema50 * 4000));
      }
    }

    // 1H trend: EMA9 vs EMA21 (more reliable than 2-candle comparison)
    let trend1h = 'FLAT';
    if (c1h.length >= 21) {
      const ema9 = calculateEma(c1h, 9);
      const ema21 = calculateEma(c1h, 21);
      const curr = c1h[c1h.length - 1];
      if (curr > ema9 && ema9 > ema21) trend1h = 'UP';
      else if (curr < ema9 && ema9 < ema21) trend1h = 'DOWN';
    }

    // Compute chg1h before scorePillars (needed for OI divergence check)
    const chg1h = c1h.length > 1 && c1h[c1h.length - 2] > 0
      ? Math.round((c1h[c1h.length - 1] - c1h[c1h.length - 2]) / c1h[c1h.length - 2] * 100 * 100) / 100 : 0;

    // Direction: requires 1H and 4H agreement — returns null if conflicting
    const direction = chooseDirection(rsi1h, trend4h, trend1h, topLs, takerR);
    if (direction === null) return null; // Conflicting timeframes — skip

    const { sm, ms, tech, fund, risks, favorable, annualized, hardVeto } = scorePillars(
      direction, rsi1h, rsi15m, trend4h, volR, oiChg, topLs, takerR, fundingRate, chg1h
    );
    if (hardVeto) return null; // Extreme funding rate — skip

    const trendAligned = (direction === 'LONG' && trend4h === 'UP')
                      || (direction === 'SHORT' && trend4h === 'DOWN');
    const finalScore = sm + ms + tech + fund;
    const leverage = recommendLeverage(atrPct);

    const prev = prevState[symbol] ?? { finalScore, scanStreak: 0 };
    const scanStreak = prev.scanStreak + 1;
    const scoreDelta = finalScore - prev.finalScore;

    // Pivot points from last complete 4H candle (replaces naive min/max S/R)
    const pivots = klines4h ? calculatePivotPoints(klines4h.highs, klines4h.lows, klines4h.closes) : null;

    const chg4h = c1h.length > 5 && c1h[c1h.length - 5] > 0
      ? Math.round((c1h[c1h.length - 1] - c1h[c1h.length - 5]) / c1h[c1h.length - 5] * 100 * 100) / 100 : 0;
    const chg24h = Math.round(parseFloat(ticker.priceChangePercent ?? '0') * 100) / 100;

    const patterns1h = detectPatterns(c1h, o1h, h1h, l1h);
    const patterns15m = klines15m
      ? detectPatterns(klines15m.closes, klines15m.opens, klines15m.highs, klines15m.lows)
      : [];

    const momentum15m = klines15m && klines15m.closes.length >= 5 && klines15m.closes[klines15m.closes.length - 5] > 0
      ? Math.round((klines15m.closes[klines15m.closes.length - 1] - klines15m.closes[klines15m.closes.length - 5])
          / klines15m.closes[klines15m.closes.length - 5] * 100 * 100) / 100
      : null;

    const smTraders = Math.max(sm, 1) * 10;
    const smPnl = topLs !== null ? Math.round((topLs - 1) * 12 * 10) / 10 : 0;
    const smAccel = oiChg !== null ? Math.round(oiChg / 10 * 100) / 100 : 0;

    return {
      asset: symbol.replace('USDT', ''),
      direction,
      leverage,
      finalScore,
      scoreDelta,
      scanStreak,
      hourlyTrend: trend1h, // EMA9/EMA21 based — replaces naive 2-candle comparison
      trendAligned,
      pillarScores: { smartMoney: sm, marketStructure: ms, technicals: tech, funding: fund },
      smartMoney: { traders: smTraders, pnlPct: smPnl, accel: smAccel, direction },
      technicals: {
        rsi1h, rsi15m, volRatio1h: volR, volRatio15m: volR15m,
        trend4h, trend1h, trendStrength, patterns1h, patterns15m,
        momentum15m, chg1h, chg4h, chg24h,
        support: pivots?.s1 ?? null,    // S1 from pivot points
        resistance: pivots?.r1 ?? null, // R1 from pivot points
        pivots,
        atrPct,
      },
      funding: {
        rate: fundingRate !== null ? Math.round(fundingRate * 1_000_000) / 1_000_000 : 0,
        annualized,
        favorable,
      },
      risks,
      _symbol: symbol,
      _finalScore: finalScore,
    };
  } catch {
    return null;
  }
}

// ─── Concurrency limiter ──────────────────────────────────────────────────────

async function runConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R | null>,
  concurrency: number
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// ─── Main scan function ───────────────────────────────────────────────────────

export async function runOpportunityScan(): Promise<OpportunityScanResult> {
  const scanTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const prevState = loadState();

  // Fetch all tickers
  const allTickers = await getJson<TickerRow[]>(`${BASE_URL}/fapi/v1/ticker/24hr`);
  if (!allTickers || !Array.isArray(allTickers)) {
    throw new Error('Failed to fetch Binance Futures tickers');
  }

  const tickerMap = new Map(allTickers.map((t) => [t.symbol, t]));
  const assetsScanned = allTickers.length;

  // Stage 1: volume + symbol filter
  const stage1 = allTickers
    .filter((t) => {
      const sym = t.symbol;
      if (!sym.endsWith('USDT')) return false;
      if (EXCLUDE_SYMBOLS.has(sym)) return false;
      const base = sym.slice(0, -4);
      if (EXCLUDE_SUFFIXES.some((sfx) => base.endsWith(sfx))) return false;
      return parseFloat(t.quoteVolume) >= MIN_VOLUME_USDT;
    })
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, STAGE1_LIMIT);

  const passedStage1 = stage1.length;

  // Stage 2: quick RSI + volume ratio check
  const stage2Results = await runConcurrent(
    stage1,
    async (t) => {
      const klines = await fetchKlines(t.symbol, '1h', 22);
      if (!klines) return null;
      const rsi = calculateRsi(klines.closes);
      const volR = volumeRatio(klines.vols);
      if (rsi >= 25 && rsi <= 78 && volR >= 0.6) return { sym: t.symbol, rsi, volR, ticker: t };
      return null;
    },
    12
  );

  const stage2 = stage2Results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => {
      const scoreA = a.volR * (1 + Math.min(Math.abs(a.rsi - 30), Math.abs(a.rsi - 50), Math.abs(a.rsi - 70)) / 80);
      const scoreB = b.volR * (1 + Math.min(Math.abs(b.rsi - 30), Math.abs(b.rsi - 50), Math.abs(b.rsi - 70)) / 80);
      return scoreB - scoreA;
    });

  const passedStage2 = stage2.length;
  const deepTargets = stage2.slice(0, DEEP_LIMIT);

  // Deep dive — analyzeAsset already filters out conflicting trends and funding vetoes
  const deepResults = (await runConcurrent(
    deepTargets,
    (item) => analyzeAsset(item.sym, item.ticker, prevState),
    MAX_CONCURRENT
  )).filter((r): r is NonNullable<typeof r> => r !== null);

  const deepDived = deepResults.length;
  deepResults.sort((a, b) => b.finalScore - a.finalScore);

  // ── Save state for ALL analyzed assets BEFORE applying post-analysis gates ──
  // This ensures streak keeps accumulating even when filtered by BTC gate or score floor,
  // so the signal can qualify on the next scan if conditions improve.
  const newState: ScanState = {};
  for (const opp of deepResults) {
    newState[opp._symbol] = { finalScore: opp._finalScore, scanStreak: opp.scanStreak };
  }
  saveState(newState);

  // ── BTC 4H trend for correlation gate ────────────────────────────────────────
  const [btcKlines1h, btcKlines4h] = await Promise.all([
    fetchKlines('BTCUSDT', '1h', 3),
    fetchKlines('BTCUSDT', '4h', 55),
  ]);

  let btcTrend = 'FLAT';
  let btcChg1h = 0;
  if (btcKlines1h && btcKlines1h.closes.length >= 2) {
    const bc = btcKlines1h.closes;
    btcTrend = bc[bc.length - 1] > bc[bc.length - 2] ? 'UP' : 'DOWN';
    btcChg1h = bc[bc.length - 2] > 0
      ? Math.round((bc[bc.length - 1] - bc[bc.length - 2]) / bc[bc.length - 2] * 100 * 100) / 100 : 0;
  }

  let btcTrend4h = 'FLAT';
  if (btcKlines4h && btcKlines4h.closes.length >= 20) {
    const c4h = btcKlines4h.closes;
    const ema20 = calculateEma(c4h, 20);
    const ema50 = calculateEma(c4h, Math.min(50, c4h.length));
    const curr = c4h[c4h.length - 1];
    if (curr > ema20 && ema20 > ema50) btcTrend4h = 'UP';
    else if (curr < ema20 && ema20 < ema50) btcTrend4h = 'DOWN';
  }

  // ── Post-analysis quality gates ───────────────────────────────────────────
  // Applied AFTER state is saved so streaks accumulate independently
  const qualified = deepResults.filter((opp) => {
    // 1. BTC correlation gate — altcoins almost never sustainably rally against BTC trend
    if (btcTrend4h === 'DOWN' && opp.direction === 'LONG') return false;
    if (btcTrend4h === 'UP' && opp.direction === 'SHORT') return false;
    // 2. Minimum absolute score floor
    if (opp._finalScore < MIN_SCORE) return false;
    // 3. Scan streak — must appear in N consecutive scans to filter one-scan flukes
    if (opp.scanStreak < MIN_SCAN_STREAK) return false;
    return true;
  });

  const filteredByGates = deepResults.length - qualified.length;
  const topOpps = qualified.slice(0, TOP_OUTPUT);

  const btcTicker = tickerMap.get('BTCUSDT');

  // Strip internal fields before returning
  const clean = topOpps.map(({ _symbol: _s, _finalScore: _f, ...rest }) => rest) as OpportunityResult[];

  return {
    scanTime,
    assetsScanned,
    passedStage1,
    passedStage2,
    deepDived,
    disqualified: assetsScanned - deepResults.length,
    filteredByGates,
    btcContext: {
      price: btcTicker ? Math.round(parseFloat(btcTicker.lastPrice) * 100) / 100 : 0,
      trend: btcTrend,
      trend4h: btcTrend4h,
      change1h: btcChg1h,
      change24h: btcTicker ? Math.round(parseFloat(btcTicker.priceChangePercent) * 100) / 100 : 0,
    },
    opportunities: clean,
  };
}
