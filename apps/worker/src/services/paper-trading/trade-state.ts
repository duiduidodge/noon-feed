/**
 * Paper Trading State — JSON file persistence
 * Follows the same pattern as opportunity-scanner.ts state management.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { PaperTradingState } from './types.js';

const STATE_FILE = join(process.cwd(), 'artifacts', '.paper-trading-state.json');

function defaultState(initialEquity: number): PaperTradingState {
  return {
    account: {
      equity: initialEquity,
      peakEquity: initialEquity,
      drawdownPct: 0,
      totalTrades: 0,
      winCount: 0,
      lossCount: 0,
      totalPnlUsd: 0,
      dailyPnlUsd: 0,
      dailyPnlDate: new Date().toISOString().slice(0, 10),
      isHalted: false,
    },
    openPositions: [],
    pendingOrders: [],
    recentTrades: [],
    lastSlByAsset: {},
  };
}

export async function loadState(initialEquity: number): Promise<PaperTradingState> {
  try {
    const raw = await readFile(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as PaperTradingState;
    // Ensure all fields exist (forward-compat)
    if (!parsed.account) return defaultState(initialEquity);
    if (!parsed.openPositions) parsed.openPositions = [];
    if (!parsed.pendingOrders) parsed.pendingOrders = [];
    if (!parsed.recentTrades) parsed.recentTrades = [];
    if (!parsed.lastSlByAsset) parsed.lastSlByAsset = {};
    return parsed;
  } catch {
    return defaultState(initialEquity);
  }
}

export async function saveState(state: PaperTradingState): Promise<void> {
  // Trim recent trades to last 100
  if (state.recentTrades.length > 100) {
    state.recentTrades = state.recentTrades.slice(-100);
  }

  try {
    await mkdir(dirname(STATE_FILE), { recursive: true });
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('[paper-trading] Failed to save state:', err);
  }
}
