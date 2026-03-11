/**
 * Paper Trading System — Main Orchestrator
 *
 * Runs on a configurable interval inside the worker main loop.
 * Fetches klines from Binance, runs SMC analysis, evaluates entries,
 * monitors positions, and posts trade events to Discord.
 *
 * v2 improvements:
 * - Passes OhlcArrays to trailing stop for faster reaction
 * - Handles limit orders (pending + fill detection)
 * - Tracks last candle close time to avoid redundant evaluations
 * - Re-entry cooldown after SL hits
 */

import type { PaperTradingConfig, PaperTradingState } from './types.js';
import { DEFAULT_CONFIG as DEFAULTS } from './types.js';
import { analyzeSmcSetup, evaluateEntrySignal } from './smc-strategy.js';
import { tryOpenPosition, monitorPositions, checkPendingOrders } from './position-manager.js';
import { checkHaltCooldown } from './risk-manager.js';
import { loadState, saveState } from './trade-state.js';
import {
  buildTradeOpenedEmbed,
  buildTradeClosedEmbed,
  buildTp1HitEmbed,
  buildDrawdownAlertEmbed,
  sendTradeWebhook,
} from './discord-trade-poster.js';
import type { OhlcArrays } from '../smart-money-concepts.js';

// ── Config from env ──────────────────────────────────────────────────────────

function loadConfig(): PaperTradingConfig {
  const assets = (process.env.PAPER_TRADING_ASSETS ?? 'BTC,ETH,SOL')
    .split(',')
    .map((s) => s.trim().toUpperCase());

  return {
    ...DEFAULTS,
    assets,
    riskPerTradePct: Number(process.env.PAPER_TRADING_RISK_PER_TRADE ?? DEFAULTS.riskPerTradePct),
    minRR: Number(process.env.PAPER_TRADING_MIN_RR ?? DEFAULTS.minRR),
    maxConcurrent: Number(process.env.PAPER_TRADING_MAX_CONCURRENT ?? DEFAULTS.maxConcurrent),
    maxDrawdownPct: Number(process.env.PAPER_TRADING_MAX_DRAWDOWN ?? DEFAULTS.maxDrawdownPct),
    dailyLossLimitPct: Number(process.env.PAPER_TRADING_DAILY_LOSS_LIMIT ?? DEFAULTS.dailyLossLimitPct),
    initialEquity: Number(process.env.PAPER_TRADING_INITIAL_EQUITY ?? DEFAULTS.initialEquity),
    cycleIntervalSeconds: Number(process.env.PAPER_TRADING_INTERVAL_SECONDS ?? DEFAULTS.cycleIntervalSeconds),
    maxHoldHours: Number(process.env.PAPER_TRADING_MAX_HOLD_HOURS ?? DEFAULTS.maxHoldHours),
    minAdxTrending: Number(process.env.PAPER_TRADING_MIN_ADX ?? DEFAULTS.minAdxTrending),
    reEntryCooldownHours: Number(process.env.PAPER_TRADING_REENTRY_COOLDOWN_HOURS ?? DEFAULTS.reEntryCooldownHours),
  };
}

// ── Binance Kline Fetcher ────────────────────────────────────────────────────

const BINANCE_BASE = 'https://fapi.binance.com';

async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number,
): Promise<OhlcArrays | null> {
  const url = `${BINANCE_BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) return null;
    const data = (await resp.json()) as unknown[][];
    if (!Array.isArray(data) || data.length === 0) return null;
    return {
      opens: data.map((k) => parseFloat(k[1] as string)),
      highs: data.map((k) => parseFloat(k[2] as string)),
      lows: data.map((k) => parseFloat(k[3] as string)),
      closes: data.map((k) => parseFloat(k[4] as string)),
      vols: data.map((k) => parseFloat(k[5] as string)),
    };
  } catch {
    return null;
  }
}

function toSymbol(asset: string): string {
  return `${asset}USDT`;
}

// ── Main Cycle ───────────────────────────────────────────────────────────────

let _state: PaperTradingState | null = null;
let _config: PaperTradingConfig | null = null;
let _wasHaltedNotified = false;
/** Track last 4H candle close time per asset to avoid evaluating mid-candle */
const _lastCandleClose = new Map<string, number>();

export async function runPaperTradingCycle(): Promise<void> {
  if (!_config) _config = loadConfig();
  if (!_state) {
    _state = await loadState(_config.initialEquity);
    // Ensure new state fields exist (forward-compat)
    if (!_state.pendingOrders) _state.pendingOrders = [];
    if (!_state.lastSlByAsset) _state.lastSlByAsset = {};
  }

  const config = _config;
  const state = _state;
  const webhookUrl = process.env.DISCORD_PAPER_TRADE_WEBHOOK ?? process.env.DISCORD_SIGNAL_WEBHOOK_URL;

  const log = (msg: string) => console.log(`[paper-trading] ${msg}`);

  // Check halt cooldown
  if (state.account.isHalted) {
    if (checkHaltCooldown(state.account)) {
      log('Halt cooldown expired — resuming trading');
      state.account.isHalted = false;
      state.account.haltReason = undefined;
      state.account.haltedAt = undefined;
      _wasHaltedNotified = false;
    } else {
      if (!_wasHaltedNotified) {
        log(`Account halted: ${state.account.haltReason}`);
        _wasHaltedNotified = true;
      }
      return;
    }
  }

  // ── Fetch klines for all assets ─────────────────────────────────────────
  const smcByAsset4h = new Map<string, ReturnType<typeof analyzeSmcSetup>>();
  const smcByAsset1h = new Map<string, ReturnType<typeof analyzeSmcSetup>>();
  const ohlcByAsset4h = new Map<string, OhlcArrays>();
  const candleHighs = new Map<string, number>();
  const candleLows = new Map<string, number>();
  const currentPrices = new Map<string, number>();

  await Promise.all(
    config.assets.map(async (asset) => {
      const symbol = toSymbol(asset);
      const [klines4h, klines1h] = await Promise.all([
        fetchKlines(symbol, '4h', 200),
        fetchKlines(symbol, '1h', 200),
      ]);

      if (klines4h) {
        const smc = analyzeSmcSetup(klines4h, asset, '4h', 5);
        smcByAsset4h.set(asset, smc);
        ohlcByAsset4h.set(asset, klines4h);
        currentPrices.set(asset, smc.currentPrice);

        const n = klines4h.highs.length;
        candleHighs.set(asset, klines4h.highs[n - 1]);
        candleLows.set(asset, klines4h.lows[n - 1]);
      }

      if (klines1h) {
        smcByAsset1h.set(asset, analyzeSmcSetup(klines1h, asset, '1h', 8));
      }
    }),
  );

  // ── Check pending limit orders for fills ──────────────────────────────
  const filledOrders = checkPendingOrders(state, candleHighs, candleLows, config);
  for (const pos of filledOrders) {
    state.openPositions.push(pos);
    log(
      `LIMIT FILLED ${pos.direction} ${pos.asset} @ $${pos.entryPrice.toFixed(2)} ` +
      `SL:$${pos.slPrice.toFixed(2)} TP1:$${pos.tp1Price.toFixed(2)} R:R ${pos.rrRatio}`,
    );
    if (webhookUrl) {
      await sendTradeWebhook(webhookUrl, buildTradeOpenedEmbed(pos));
    }
  }

  // ── Monitor existing positions ──────────────────────────────────────────
  const events = monitorPositions(
    state,
    smcByAsset4h,
    ohlcByAsset4h,
    candleHighs,
    candleLows,
    currentPrices,
    config,
  );

  // Post events to Discord
  if (webhookUrl) {
    for (const evt of events) {
      if (evt.type === 'SL_HIT' || evt.type === 'TP2_HIT' || evt.type === 'CLOSED') {
        await sendTradeWebhook(webhookUrl, buildTradeClosedEmbed(evt.position));
      } else if (evt.type === 'TP1_HIT') {
        await sendTradeWebhook(
          webhookUrl,
          buildTp1HitEmbed(evt.position, evt.pnlUsd ?? 0),
        );
      }
    }
  }

  // Check if drawdown breaker triggered
  if (state.account.isHalted && webhookUrl && !_wasHaltedNotified) {
    await sendTradeWebhook(webhookUrl, buildDrawdownAlertEmbed(state.account));
    _wasHaltedNotified = true;
    await saveState(state);
    return;
  }

  // ── Evaluate new entries ────────────────────────────────────────────────
  for (const asset of config.assets) {
    const smc4h = smcByAsset4h.get(asset);
    const smc1h = smcByAsset1h.get(asset);
    const ohlc4h = ohlcByAsset4h.get(asset);
    if (!smc4h || !smc1h || !ohlc4h) continue;

    // Already have a position or pending order?
    if (state.openPositions.some((p) => p.asset === asset)) continue;
    if (state.pendingOrders.some((o) => o.asset === asset)) continue;

    // Check if this is a new candle close (avoid re-evaluating same candle)
    const lastClose = ohlc4h.closes[ohlc4h.closes.length - 2]; // second-to-last = last closed candle
    const prevClose = _lastCandleClose.get(asset);
    if (prevClose !== undefined && prevClose === lastClose) {
      // Same candle as last check — skip entry evaluation (but monitoring still runs)
      continue;
    }
    _lastCandleClose.set(asset, lastClose);

    const signal = evaluateEntrySignal(smc4h, smc1h, ohlc4h, config);
    if (!signal) continue;

    const result = tryOpenPosition(signal, state, config);
    if (result.position) {
      state.openPositions.push(result.position);
      log(
        `OPENED ${result.position.direction} ${asset} @ $${result.position.entryPrice.toFixed(2)} ` +
        `SL:$${result.position.slPrice.toFixed(2)} TP1:$${result.position.tp1Price.toFixed(2)} ` +
        `R:R ${result.position.rrRatio} Size:$${result.position.sizeUsd.toFixed(0)} Score:${signal.score}`,
      );
      if (webhookUrl) {
        await sendTradeWebhook(webhookUrl, buildTradeOpenedEmbed(result.position));
      }
    } else if (result.pendingOrder) {
      state.pendingOrders.push(result.pendingOrder);
      log(
        `LIMIT ORDER ${result.pendingOrder.direction} ${asset} @ $${result.pendingOrder.limitPrice.toFixed(2)} ` +
        `SL:$${result.pendingOrder.slPrice.toFixed(2)} R:R ${result.pendingOrder.rrRatio} Score:${signal.score}`,
      );
    } else {
      log(`${asset} signal rejected: ${result.reason}`);
    }
  }

  // ── Log status ──────────────────────────────────────────────────────────
  const openSummary = state.openPositions
    .map((p) => `${p.asset}:${p.direction}(${p.unrealisedPnl >= 0 ? '+' : ''}$${p.unrealisedPnl.toFixed(2)})`)
    .join(' ');

  const pendingSummary = state.pendingOrders
    .map((o) => `${o.asset}:${o.direction}@$${o.limitPrice.toFixed(0)}`)
    .join(' ');

  log(
    `Equity: $${state.account.equity.toFixed(2)} | ` +
    `DD: ${state.account.drawdownPct.toFixed(1)}% | ` +
    `Trades: ${state.account.totalTrades} (${state.account.winCount}W/${state.account.lossCount}L) | ` +
    `Open: ${state.openPositions.length > 0 ? openSummary : 'none'}` +
    (state.pendingOrders.length > 0 ? ` | Pending: ${pendingSummary}` : ''),
  );

  state.lastCycleAt = new Date().toISOString();
  await saveState(state);
}

// ── Exports for worker integration ───────────────────────────────────────────

export function isPaperTradingEnabled(): boolean {
  return process.env.ENABLE_PAPER_TRADING === 'true';
}

export function getPaperTradingIntervalMs(): number {
  const config = loadConfig();
  return config.cycleIntervalSeconds * 1000;
}
