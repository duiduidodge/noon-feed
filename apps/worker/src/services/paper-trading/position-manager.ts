/**
 * Position Manager — Open/close/monitor paper trading positions
 *
 * Simulated execution: SL/TP fills detected from candle high/low data.
 *
 * v2 improvements:
 * - Time-based exit (max hold hours)
 * - Limit order support (pending orders that fill at zone edge)
 * - Re-entry cooldown after SL hit
 */

import { randomUUID } from 'node:crypto';
import type {
  PaperPosition,
  PaperTradingConfig,
  PaperTradingState,
  SmcAnalysis,
  SmcEntrySignal,
  PendingLimitOrder,
  ExitReason,
} from './types.js';
import {
  calculatePositionSize,
  canOpenNewTrade,
  checkCorrelationGuard,
  updateAccountState,
} from './risk-manager.js';
import { checkStructureInvalidation, calculateTrailingStop } from './smc-strategy.js';
import type { OhlcArrays } from '../smart-money-concepts.js';

// ── Open Position ────────────────────────────────────────────────────────────

export function tryOpenPosition(
  signal: SmcEntrySignal,
  state: PaperTradingState,
  config: PaperTradingConfig,
): { position: PaperPosition | null; pendingOrder: PendingLimitOrder | null; reason: string | null } {
  // Risk checks
  const permission = canOpenNewTrade(
    state.account,
    state.openPositions,
    signal.asset,
    config.riskPerTradePct,
    config,
  );
  if (!permission.allowed) {
    return { position: null, pendingOrder: null, reason: permission.reason! };
  }

  // Correlation guard
  const corrCheck = checkCorrelationGuard(
    signal.asset,
    signal.direction,
    state.openPositions,
  );
  if (!corrCheck.allowed) {
    return { position: null, pendingOrder: null, reason: corrCheck.reason! };
  }

  // Re-entry cooldown check
  const lastSl = state.lastSlByAsset[signal.asset];
  if (lastSl) {
    const hoursSinceSl = (Date.now() - new Date(lastSl).getTime()) / (1000 * 60 * 60);
    if (hoursSinceSl < config.reEntryCooldownHours) {
      return {
        position: null,
        pendingOrder: null,
        reason: `Re-entry cooldown: ${(config.reEntryCooldownHours - hoursSinceSl).toFixed(1)}h remaining for ${signal.asset}`,
      };
    }
  }

  // Already have a pending order for this asset?
  if (state.pendingOrders.some((o) => o.asset === signal.asset)) {
    return { position: null, pendingOrder: null, reason: `Already have pending order for ${signal.asset}` };
  }

  // Position sizing
  const effectiveEntry = signal.entryType === 'limit' ? signal.limitPrice : signal.entryPrice;
  const sizing = calculatePositionSize(
    state.account.equity,
    effectiveEntry,
    signal.slPrice,
    config,
  );

  // ── Limit order: create pending order ───────────────────────────────────
  if (signal.entryType === 'limit') {
    const pending: PendingLimitOrder = {
      id: randomUUID(),
      asset: signal.asset,
      direction: signal.direction,
      limitPrice: signal.limitPrice,
      slPrice: signal.slPrice,
      tp1Price: signal.tp1Price,
      tp2Price: signal.tp2Price,
      sizeUsd: sizing.sizeUsd,
      leverage: sizing.leverage,
      riskPct: config.riskPerTradePct,
      rrRatio: signal.rrRatio,
      score: signal.score,
      createdAt: new Date().toISOString(),
      expiresAfterHours: 12, // Limit orders expire after 12h
      smcContext: signal.smcContext,
    };
    return { position: null, pendingOrder: pending, reason: null };
  }

  // ── Market order: immediate fill with slippage ──────────────────────────
  const slippage = signal.entryPrice * (config.slippagePct / 100);
  const entryPrice =
    signal.direction === 'LONG'
      ? signal.entryPrice + slippage
      : signal.entryPrice - slippage;

  const position: PaperPosition = {
    id: randomUUID(),
    asset: signal.asset,
    direction: signal.direction,
    entryPrice,
    currentPrice: entryPrice,
    slPrice: signal.slPrice,
    tp1Price: signal.tp1Price,
    tp2Price: signal.tp2Price,
    sizeUsd: sizing.sizeUsd,
    remainingSizeUsd: sizing.sizeUsd,
    leverage: sizing.leverage,
    riskPct: config.riskPerTradePct,
    rrRatio: signal.rrRatio,
    unrealisedPnl: 0,
    status: 'OPEN',
    tp1Hit: false,
    slMovedToBreakeven: false,
    openedAt: new Date().toISOString(),
    smcContext: signal.smcContext,
  };

  return { position, pendingOrder: null, reason: null };
}

// ── Check Pending Limit Orders ───────────────────────────────────────────────

export function checkPendingOrders(
  state: PaperTradingState,
  candleHighs: Map<string, number>,
  candleLows: Map<string, number>,
  config: PaperTradingConfig,
): PaperPosition[] {
  const filled: PaperPosition[] = [];
  const now = Date.now();

  state.pendingOrders = state.pendingOrders.filter((order) => {
    // Check expiry
    const ageHours = (now - new Date(order.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageHours >= order.expiresAfterHours) return false; // expired

    // Check if limit price was hit
    const high = candleHighs.get(order.asset);
    const low = candleLows.get(order.asset);
    if (high === undefined || low === undefined) return true; // keep

    const limitHit =
      order.direction === 'LONG'
        ? low <= order.limitPrice // price dipped to our buy level
        : high >= order.limitPrice; // price rose to our sell level

    if (!limitHit) return true; // keep waiting

    // Already have a position in this asset? Cancel the order.
    if (state.openPositions.some((p) => p.asset === order.asset)) return false;

    // Fill the order
    const slippage = order.limitPrice * (config.slippagePct / 100);
    const entryPrice =
      order.direction === 'LONG'
        ? order.limitPrice + slippage
        : order.limitPrice - slippage;

    const position: PaperPosition = {
      id: randomUUID(),
      asset: order.asset,
      direction: order.direction,
      entryPrice,
      currentPrice: entryPrice,
      slPrice: order.slPrice,
      tp1Price: order.tp1Price,
      tp2Price: order.tp2Price,
      sizeUsd: order.sizeUsd,
      remainingSizeUsd: order.sizeUsd,
      leverage: order.leverage,
      riskPct: order.riskPct,
      rrRatio: order.rrRatio,
      unrealisedPnl: 0,
      status: 'OPEN',
      tp1Hit: false,
      slMovedToBreakeven: false,
      openedAt: new Date().toISOString(),
      smcContext: order.smcContext,
    };

    filled.push(position);
    return false; // remove from pending
  });

  return filled;
}

// ── Monitor Positions ────────────────────────────────────────────────────────

export interface PositionEvent {
  type: 'TP1_HIT' | 'TP2_HIT' | 'SL_HIT' | 'CLOSED' | 'SL_UPDATED';
  position: PaperPosition;
  pnlUsd?: number;
  exitReason?: ExitReason;
}

export function monitorPositions(
  state: PaperTradingState,
  smcByAsset: Map<string, SmcAnalysis>,
  ohlcByAsset: Map<string, OhlcArrays>,
  candleHighs: Map<string, number>,
  candleLows: Map<string, number>,
  currentPrices: Map<string, number>,
  config: PaperTradingConfig,
): PositionEvent[] {
  const events: PositionEvent[] = [];
  const now = Date.now();

  for (const pos of state.openPositions) {
    const high = candleHighs.get(pos.asset) ?? pos.currentPrice;
    const low = candleLows.get(pos.asset) ?? pos.currentPrice;
    const current = currentPrices.get(pos.asset) ?? pos.currentPrice;
    pos.currentPrice = current;

    // Update unrealised P&L
    const priceDelta =
      pos.direction === 'LONG'
        ? current - pos.entryPrice
        : pos.entryPrice - current;
    pos.unrealisedPnl =
      (priceDelta / pos.entryPrice) * pos.remainingSizeUsd;

    // ── Time-based exit ──────────────────────────────────────────────────
    const holdHours = (now - new Date(pos.openedAt).getTime()) / (1000 * 60 * 60);
    if (holdHours >= config.maxHoldHours) {
      const pnl = calculatePnl(pos, current, pos.remainingSizeUsd);
      closePosition(pos, 'TIME_EXIT', current, pnl);
      events.push({ type: 'CLOSED', position: pos, pnlUsd: pnl, exitReason: 'TIME_EXIT' });
      continue;
    }

    // ── Check SL hit ────────────────────────────────────────────────────
    const slHit =
      pos.direction === 'LONG' ? low <= pos.slPrice : high >= pos.slPrice;

    if (slHit) {
      const slippage = pos.slPrice * (config.slippagePct / 100);
      const exitPrice =
        pos.direction === 'LONG'
          ? pos.slPrice - slippage
          : pos.slPrice + slippage;

      const pnl = calculatePnl(pos, exitPrice, pos.remainingSizeUsd);
      closePosition(pos, 'SL_HIT', exitPrice, pnl);
      // Track SL time for re-entry cooldown
      state.lastSlByAsset[pos.asset] = new Date().toISOString();
      events.push({ type: 'SL_HIT', position: pos, pnlUsd: pnl, exitReason: 'SL_HIT' });
      continue;
    }

    // ── Check TP2 hit (if TP1 already hit) ──────────────────────────────
    if (pos.tp1Hit) {
      const tp2Hit =
        pos.direction === 'LONG'
          ? high >= pos.tp2Price
          : low <= pos.tp2Price;

      if (tp2Hit) {
        const pnl = calculatePnl(pos, pos.tp2Price, pos.remainingSizeUsd);
        closePosition(pos, 'TP2_HIT', pos.tp2Price, pnl);
        events.push({ type: 'TP2_HIT', position: pos, pnlUsd: pnl, exitReason: 'TP2_HIT' });
        continue;
      }
    }

    // ── Check TP1 hit ───────────────────────────────────────────────────
    if (!pos.tp1Hit) {
      const tp1Hit =
        pos.direction === 'LONG'
          ? high >= pos.tp1Price
          : low <= pos.tp1Price;

      if (tp1Hit) {
        const closeSize = pos.remainingSizeUsd * 0.5;
        const pnl = calculatePnl(pos, pos.tp1Price, closeSize);
        pos.tp1Hit = true;
        pos.remainingSizeUsd -= closeSize;
        pos.status = 'PARTIAL';
        pos.slPrice = pos.entryPrice;
        pos.slMovedToBreakeven = true;

        events.push({ type: 'TP1_HIT', position: pos, pnlUsd: pnl, exitReason: 'TP1_HIT' });
      }
    }

    // ── Structure invalidation check ────────────────────────────────────
    const smc = smcByAsset.get(pos.asset);
    if (smc) {
      const invalidation = checkStructureInvalidation(pos, smc);
      if (invalidation) {
        const pnl = calculatePnl(pos, current, pos.remainingSizeUsd);
        closePosition(pos, invalidation, current, pnl);
        events.push({
          type: 'CLOSED',
          position: pos,
          pnlUsd: pnl,
          exitReason: invalidation,
        });
        continue;
      }

      // ── Trailing stop update (improved: uses recent candle data) ────
      if (pos.tp1Hit) {
        const ohlc = ohlcByAsset.get(pos.asset) ?? null;
        const newSl = calculateTrailingStop(pos, smc, ohlc);
        if (newSl !== pos.slPrice) {
          pos.slPrice = newSl;
          events.push({ type: 'SL_UPDATED', position: pos });
        }
      }
    }
  }

  // Move closed positions to recent trades
  const closed = state.openPositions.filter((p) => p.status === 'CLOSED');
  state.openPositions = state.openPositions.filter((p) => p.status !== 'CLOSED');
  state.recentTrades.push(...closed);

  // Update account for closed trades
  for (const trade of closed) {
    state.account = updateAccountState(state.account, trade.realisedPnl ?? 0, config);
  }

  // Account for partial close P&L (TP1)
  for (const evt of events) {
    if (evt.type === 'TP1_HIT' && evt.pnlUsd) {
      state.account = updateAccountState(state.account, evt.pnlUsd, config);
    }
  }

  return events;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function calculatePnl(
  pos: PaperPosition,
  exitPrice: number,
  sizeUsd: number,
): number {
  const priceDelta =
    pos.direction === 'LONG'
      ? exitPrice - pos.entryPrice
      : pos.entryPrice - exitPrice;
  return (priceDelta / pos.entryPrice) * sizeUsd;
}

function closePosition(
  pos: PaperPosition,
  reason: ExitReason,
  exitPrice: number,
  pnl: number,
): void {
  pos.status = 'CLOSED';
  pos.closedAt = new Date().toISOString();
  pos.exitReason = reason;
  pos.currentPrice = exitPrice;
  pos.realisedPnl = (pos.realisedPnl ?? 0) + pnl;
  pos.remainingSizeUsd = 0;
}
