/**
 * Signal enrichment pipeline: chart rendering → vision analysis → thesis generation.
 * Mutates the signal object in-place with thesis bullets and chart image.
 */

import type { LLMProviderInterface } from '@crypto-news/shared';
import { createLogger } from '@crypto-news/shared';
import type { OpportunityResult, OpportunityScanResult } from './opportunity-scanner.js';
import { renderChartImage } from './chart-image.js';
import { analyzeChart } from './chart-analysis.js';
import { generateThesis } from './thesis-generator.js';

const logger = createLogger('worker:signal-enrichment');

const BASE_URL = 'https://fapi.binance.com';
const REQUEST_TIMEOUT_MS = 12_000;

interface KlineData {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  vols: number[];
}

async function fetchKlines(symbol: string, interval: string, limit: number): Promise<KlineData | null> {
  try {
    const url = `${BASE_URL}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = await res.json() as number[][];
    return {
      opens: data.map(k => Number(k[1])),
      highs: data.map(k => Number(k[2])),
      lows: data.map(k => Number(k[3])),
      closes: data.map(k => Number(k[4])),
      vols: data.map(k => Number(k[5])),
    };
  } catch {
    return null;
  }
}

export async function enrichSignalWithThesis(
  llmProvider: LLMProviderInterface,
  signal: OpportunityResult,
  btcContext: OpportunityScanResult['btcContext'] | null,
): Promise<void> {
  const symbol = `${signal.asset}USDT`;
  const startMs = Date.now();

  // Step 1: Fetch 4H klines for chart rendering
  const klines4h = await fetchKlines(symbol, '4h', 80);
  if (!klines4h) {
    logger.warn({ asset: signal.asset }, 'Failed to fetch klines for chart; generating thesis without chart');
  }

  // Step 2: Render chart image
  let chartBase64: string | null = null;
  if (klines4h) {
    try {
      const chartBuffer = await renderChartImage({
        asset: signal.asset,
        direction: signal.direction as 'LONG' | 'SHORT',
        klines4h,
        pivots: signal.technicals.pivots ? {
          s1: signal.technicals.pivots.s1,
          pp: signal.technicals.pivots.pp,
          r1: signal.technicals.pivots.r1,
        } : null,
        support: signal.technicals.support,
        resistance: signal.technicals.resistance,
      });
      chartBase64 = chartBuffer.toString('base64');
      signal.chartImageBase64 = chartBase64;
      logger.debug({ asset: signal.asset, sizeKb: Math.round(chartBuffer.length / 1024) }, 'Chart rendered');
    } catch (err) {
      logger.warn({ error: (err as Error).message, asset: signal.asset }, 'Chart rendering failed');
    }
  }

  // Step 3: Vision LLM chart analysis
  let chartAnalysis: string | null = null;
  if (chartBase64 && llmProvider.completeWithImage) {
    chartAnalysis = await analyzeChart(
      llmProvider,
      chartBase64,
      signal.asset,
      signal.direction,
      signal.regime,
      signal.technicals.adx4h,
      signal.technicals.rsi1h,
      signal.technicals.rsi1d,
    );
  }

  // Step 4: Generate thesis bullets
  const defaultBtcContext = { price: 0, trend: 'FLAT', trend4h: 'FLAT', change1h: 0, change24h: 0 };
  const ctx = btcContext ?? defaultBtcContext;
  const thesis = await generateThesis(llmProvider, signal, chartAnalysis, {
    price: ctx.price,
    trend: ctx.trend,
    change1h: ctx.change1h,
    change24h: ctx.change24h,
  });

  signal.thesis = thesis;

  logger.info({
    asset: signal.asset,
    tier: signal.convictionTier,
    hasChart: !!chartBase64,
    hasVision: !!chartAnalysis,
    thesisCount: thesis.length,
    elapsedMs: Date.now() - startMs,
  }, 'Signal enrichment complete');
}
