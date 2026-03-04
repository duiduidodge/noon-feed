/**
 * Signal Watchlist Manager
 *
 * Tracks active opportunity signals across scans and fires state-change
 * notifications instead of posting every scan result blindly.
 *
 * State transitions that trigger notifications:
 *   NEW     — asset not in watchlist (or previously CLOSED) → added
 *   FLIP    — direction reversed on an active entry
 *   SURGE   — score jumped ≥ SCORE_SURGE_THRESHOLD on an active entry
 *   CLOSED  — active entry missed ≥ MISSED_SCANS_TO_CLOSE consecutive scans
 */

import type { PrismaClient } from '@prisma/client';
import { createLogger } from '@crypto-news/shared';
import type { OpportunityResult } from './opportunity-scanner.js';

const logger = createLogger('worker:watchlist');

const MISSED_SCANS_TO_CLOSE = 3;
const SCORE_SURGE_THRESHOLD = 40;

export type WatchlistEvent =
  | { type: 'NEW';    entry: WatchlistEntry; signal: OpportunityResult }
  | { type: 'FLIP';   entry: WatchlistEntry; signal: OpportunityResult; prevDirection: string }
  | { type: 'SURGE';  entry: WatchlistEntry; signal: OpportunityResult; prevScore: number }
  | { type: 'CLOSED'; entry: WatchlistEntry };

export interface WatchlistEntry {
  id: string;
  asset: string;
  direction: string;
  entryScore: number;
  lastScore: number;
  missedScans: number;
  status: string;
  addedAt: Date;
  lastSeenAt: Date;
  closedAt: Date | null;
}

export async function processWatchlist(
  prisma: PrismaClient,
  qualifiedSignals: OpportunityResult[],
): Promise<WatchlistEvent[]> {
  const events: WatchlistEvent[] = [];
  const qualifiedMap = new Map(qualifiedSignals.map((s) => [s.asset, s]));

  // Load all ACTIVE watchlist entries
  const activeEntries = await prisma.signalWatchlist.findMany({
    where: { status: 'ACTIVE' },
  }) as WatchlistEntry[];

  const activeMap = new Map(activeEntries.map((e) => [e.asset, e]));

  // ── Process each qualified signal ─────────────────────────────────────────

  for (const signal of qualifiedSignals) {
    const existing = activeMap.get(signal.asset);

    if (!existing) {
      // Check if there's a CLOSED entry for this asset
      const closed = await prisma.signalWatchlist.findUnique({
        where: { asset: signal.asset },
      }) as WatchlistEntry | null;

      if (closed) {
        // Re-open: update the existing row
        const updated = await prisma.signalWatchlist.update({
          where: { asset: signal.asset },
          data: {
            direction: signal.direction,
            entryScore: signal.finalScore,
            lastScore: signal.finalScore,
            missedScans: 0,
            status: 'ACTIVE',
            addedAt: new Date(),
            lastSeenAt: new Date(),
            closedAt: null,
          },
        }) as WatchlistEntry;
        events.push({ type: 'NEW', entry: updated, signal });
        logger.info({ asset: signal.asset, direction: signal.direction, score: signal.finalScore }, 'Watchlist: re-opened signal');
      } else {
        // Brand new entry
        const created = await prisma.signalWatchlist.create({
          data: {
            asset: signal.asset,
            direction: signal.direction,
            entryScore: signal.finalScore,
            lastScore: signal.finalScore,
          },
        }) as WatchlistEntry;
        events.push({ type: 'NEW', entry: created, signal });
        logger.info({ asset: signal.asset, direction: signal.direction, score: signal.finalScore }, 'Watchlist: new signal');
      }
    } else {
      // Active entry — check for state changes
      const prevDirection = existing.direction;
      const prevScore = existing.lastScore;
      const directionFlipped = signal.direction !== prevDirection;
      const scoreSurged = Math.abs(signal.finalScore - prevScore) >= SCORE_SURGE_THRESHOLD;

      const updated = await prisma.signalWatchlist.update({
        where: { asset: signal.asset },
        data: {
          direction: signal.direction,
          lastScore: signal.finalScore,
          missedScans: 0,
          lastSeenAt: new Date(),
        },
      }) as WatchlistEntry;

      if (directionFlipped) {
        events.push({ type: 'FLIP', entry: updated, signal, prevDirection });
        logger.info({ asset: signal.asset, prevDirection, newDirection: signal.direction }, 'Watchlist: direction flip');
      } else if (scoreSurged) {
        events.push({ type: 'SURGE', entry: updated, signal, prevScore });
        logger.info({ asset: signal.asset, prevScore, newScore: signal.finalScore }, 'Watchlist: score surge');
      } else {
        logger.debug({ asset: signal.asset, score: signal.finalScore }, 'Watchlist: silent update');
      }
    }
  }

  // ── Process active entries NOT seen in this scan ───────────────────────────

  for (const entry of activeEntries) {
    if (qualifiedMap.has(entry.asset)) continue; // Already handled above

    const newMissedScans = entry.missedScans + 1;

    if (newMissedScans >= MISSED_SCANS_TO_CLOSE) {
      const closed = await prisma.signalWatchlist.update({
        where: { asset: entry.asset },
        data: {
          missedScans: newMissedScans,
          status: 'CLOSED',
          closedAt: new Date(),
        },
      }) as WatchlistEntry;
      events.push({ type: 'CLOSED', entry: closed });
      logger.info({ asset: entry.asset, missedScans: newMissedScans }, 'Watchlist: signal closed');
    } else {
      await prisma.signalWatchlist.update({
        where: { asset: entry.asset },
        data: { missedScans: newMissedScans },
      });
      logger.debug({ asset: entry.asset, missedScans: newMissedScans }, 'Watchlist: missed scan, still watching');
    }
  }

  return events;
}
