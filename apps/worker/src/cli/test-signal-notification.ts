/**
 * Test script: sends a sample enriched BTC signal notification to Discord.
 * Usage: npx tsx apps/worker/src/cli/test-signal-notification.ts
 */

import { buildConfig } from '@crypto-news/shared';
import { createLLMProvider } from '../services/llm-provider.js';
import { enrichSignalWithThesis } from '../services/signal-enrichment.js';
import { postWatchlistEvents } from '../services/discord-signals-poster.js';
import type { OpportunityResult } from '../services/opportunity-scanner.js';
import type { WatchlistEvent } from '../services/watchlist-manager.js';

const config = buildConfig();

const webhookUrl = process.env.DISCORD_SIGNALS_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
if (!webhookUrl) {
  console.error('No DISCORD_WEBHOOK_URL or DISCORD_SIGNALS_WEBHOOK_URL set');
  process.exit(1);
}

const apiKey = config.llm.openrouterApiKey || process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('No OPENROUTER_API_KEY set');
  process.exit(1);
}

const llmProvider = createLLMProvider('openrouter', apiKey, 'x-ai/grok-4-fast');

// Fetch live BTC price for realism
async function getBtcPrice(): Promise<number> {
  const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT');
  const data = await res.json() as { price: string };
  return parseFloat(data.price);
}

async function main() {
  console.log('Fetching live BTC price...');
  const btcPrice = await getBtcPrice();
  console.log(`BTC price: $${btcPrice.toLocaleString()}`);

  const slDistance = btcPrice * 0.025; // 2.5% SL
  const signal: OpportunityResult = {
    asset: 'BTC',
    direction: 'LONG',
    leverage: 5,
    finalScore: 272,
    scoreDelta: 8.5,
    scanStreak: 7,
    hourlyTrend: 'UP',
    trendAligned: true,
    swingGrade: true,
    volumeSpike: false,
    regime: 'TRENDING',
    exitLevels: {
      initialSL: Math.round(btcPrice - slDistance),
      trailingSLPct: 2.0,
      tp1: Math.round(btcPrice + slDistance * 2),
      tp2: Math.round(btcPrice + slDistance * 3),
      maxHoldHours: 48,
      riskPct: 2.5,
    },
    positionSize: { riskPct: 1.5, positionPct: 7.5, dollarRisk10k: 150 },
    pillarScores: { derivatives: 78, marketStructure: 85, technicals: 82, entryBonus: 15 },
    smartMoney: { traders: 120, pnlPct: 3.2, accel: 0.8, direction: 'LONG' },
    technicals: {
      rsi1h: 58, rsi15m: 55, volRatio1h: 1.8, volRatio15m: 1.5,
      trend4h: 'UP', trend1h: 'UP', trendDaily: 'UP', trendStrength: 72,
      rsi1d: 54, patterns1h: ['higher_highs'], patterns15m: [],
      momentum15m: 0.35, chg1h: 1.2, chg4h: 2.8, chg24h: 3.5,
      support: Math.round(btcPrice * 0.97),
      resistance: Math.round(btcPrice * 1.04),
      pivots: {
        pp: Math.round(btcPrice * 0.995),
        s1: Math.round(btcPrice * 0.975),
        r1: Math.round(btcPrice * 1.025),
        s2: Math.round(btcPrice * 0.955),
        r2: Math.round(btcPrice * 1.045),
      },
      weeklyPivots: {
        pp: Math.round(btcPrice * 0.99),
        s1: Math.round(btcPrice * 0.965),
        r1: Math.round(btcPrice * 1.035),
        s2: Math.round(btcPrice * 0.94),
        r2: Math.round(btcPrice * 1.06),
      },
      atrPct: 2.1,
      adx4h: 32,
      emaBounce: {
        direction: 'LONG',
        confluence: 3,
        required: 2,
        isValid: true,
        scoreBonus: 15,
        frames: [],
      },
    },
    funding: { rate: -0.0001, annualized: -8.76, favorable: true },
    hyperliquid: null,
    risks: [],
    convictionTier: 'A',
  };

  const btcContext = {
    price: btcPrice,
    trend: 'UP',
    trend4h: 'UP',
    change1h: 1.2,
    change24h: 3.5,
  };

  console.log('Enriching signal (chart + vision + thesis)...');
  const start = Date.now();
  await enrichSignalWithThesis(llmProvider, signal, btcContext);
  console.log(`Enrichment done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log(`Chart: ${signal.chartImageBase64 ? `${Math.round(signal.chartImageBase64.length / 1024)}KB` : 'none'}`);
  console.log(`Thesis: ${signal.thesis?.length ?? 0} bullets`);
  if (signal.thesis) {
    signal.thesis.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
  }

  // Build a watchlist NEW event
  const event: WatchlistEvent = {
    type: 'NEW',
    entry: {
      id: 'test-btc-signal',
      asset: 'BTC',
      direction: 'LONG',
      entryScore: 272,
      lastScore: 272,
      missedScans: 0,
      status: 'ACTIVE',
      entryPrice: btcPrice,
      exitReason: null,
      addedAt: new Date(),
      lastSeenAt: new Date(),
      closedAt: null,
    },
    signal,
  };

  console.log('Posting to Discord...');
  await postWatchlistEvents(webhookUrl!, [event]);
  console.log('Done! Check your Discord channel.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
