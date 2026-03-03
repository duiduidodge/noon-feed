/**
 * Formats and posts trading signal embeds to Discord and Telegram.
 * Called after each signal scan completes.
 */

import { createLogger } from '@crypto-news/shared';
import type { OpportunityResult } from './opportunity-scanner.js';
import { TelegramService, escapeHtml } from './telegram.js';

const logger = createLogger('worker:discord-signals');

const COLOR = {
  LONG: 0x00c853,   // green
  SHORT: 0xe53935,  // red
  MIXED: 0xf9a825,  // amber
  WHALE: 0x1565c0,  // blue
};

async function sendWebhook(webhookUrl: string, body: object): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Discord ${res.status}: ${await res.text()}`);
  }
}

// ─── Opportunity Signals ───────────────────────────────────────────────────────

export async function postOpportunitySignals(
  webhookUrl: string,
  opportunities: OpportunityResult[],
  btcContext?: { price: number; trend: string; change1h: number; change24h: number } | null,
): Promise<void> {
  if (opportunities.length === 0) return;

  const longs = opportunities.filter(o => o.direction === 'LONG').length;
  const shorts = opportunities.filter(o => o.direction === 'SHORT').length;
  const color = longs > shorts ? COLOR.LONG : shorts > longs ? COLOR.SHORT : COLOR.MIXED;

  const lines = opportunities.map(o => {
    const dir = o.direction === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
    const delta =
      o.scoreDelta > 0.5 ? ` ↑${o.scoreDelta.toFixed(1)}` :
      o.scoreDelta < -0.5 ? ` ↓${Math.abs(o.scoreDelta).toFixed(1)}` : '';
    const streak = o.scanStreak > 1 ? ` 🔥×${o.scanStreak}` : '';
    return `**${o.asset}**  ${dir} ×${o.leverage}  |  Score: **${o.finalScore.toFixed(1)}**${delta}${streak}`;
  });

  const btcLine = btcContext
    ? `\n> BTC $${btcContext.price.toLocaleString()}  ·  ${btcContext.trend}  ·  1H: ${btcContext.change1h >= 0 ? '+' : ''}${btcContext.change1h.toFixed(2)}%`
    : '';

  const pillarFields = opportunities.slice(0, 5).map(o => {
    const p = o.pillarScores;
    return {
      name: `${o.asset} — Pillars`,
      value: `SM \`${p.smartMoney.toFixed(0)}\`  Struct \`${p.marketStructure.toFixed(0)}\`  Tech \`${p.technicals.toFixed(0)}\`  Fund \`${p.funding.toFixed(0)}\``,
      inline: false,
    };
  });

  const embed = {
    title: `🎯  Trade Setups  ·  ${opportunities.length} signal${opportunities.length !== 1 ? 's' : ''}`,
    description: lines.join('\n') + btcLine,
    color,
    fields: pillarFields,
    footer: { text: `Opportunity Scanner  ·  ${new Date().toUTCString()}` },
    timestamp: new Date().toISOString(),
  };

  await sendWebhook(webhookUrl, { embeds: [embed] });
  logger.info({ count: opportunities.length }, 'Posted opportunity signals to Discord');
}

// ─── Emerging Movers ───────────────────────────────────────────────────────────

export interface EmergingAlertResult {
  signal: string;
  direction: string | null;
  currentRank: number | null;
  contribution: number | null;
  contribVelocity: number | null;
  priceChg4h: number | null;
  reasons: string[];
  isImmediate: boolean;
  isDeepClimber: boolean;
}

export async function postEmergingMoversAlerts(
  webhookUrl: string,
  alerts: EmergingAlertResult[],
): Promise<void> {
  if (alerts.length === 0) return;

  for (const alert of alerts) {
    const dirLabel = alert.direction === 'LONG' ? '🟢 LONG' : alert.direction === 'SHORT' ? '🔴 SHORT' : '⚪ N/A';
    const color = alert.direction === 'LONG' ? COLOR.LONG : alert.direction === 'SHORT' ? COLOR.SHORT : COLOR.MIXED;
    const chg4h = alert.priceChg4h != null ? `${alert.priceChg4h >= 0 ? '+' : ''}${alert.priceChg4h.toFixed(2)}%` : '—';
    const velocity = alert.contribVelocity != null ? `${alert.contribVelocity >= 0 ? '+' : ''}${alert.contribVelocity.toFixed(2)}%` : '—';
    const badge = alert.isImmediate ? '⚡ IMMEDIATE' : '📈 DEEP CLIMBER';

    const embed = {
      title: `${badge}: ${alert.signal}`,
      description: `${dirLabel}  ·  Rank **#${alert.currentRank ?? '?'}**  ·  4H: **${chg4h}**`,
      color,
      fields: [
        { name: 'Contribution', value: alert.contribution != null ? `${alert.contribution.toFixed(2)}%` : '—', inline: true },
        { name: 'Velocity', value: velocity, inline: true },
        ...(alert.reasons.length > 0
          ? [{ name: 'Signals', value: alert.reasons.slice(0, 5).join(', '), inline: false }]
          : []),
      ],
      footer: { text: `Emerging Movers  ·  ${new Date().toUTCString()}` },
      timestamp: new Date().toISOString(),
    };

    await sendWebhook(webhookUrl, { embeds: [embed] });
    logger.info({ signal: alert.signal, isImmediate: alert.isImmediate }, 'Posted emerging mover alert to Discord');
  }
}

// ─── Whale Signals ─────────────────────────────────────────────────────────────

export interface WhaleTraderResult {
  walletAddress: string;
  score: number;
  rank: number | null;
  winRate: number | null;
  consistency: string | null;
  holdTimeHours: number | null;
  allocationPct: number | null;
}

export async function postWhaleSnapshot(
  webhookUrl: string,
  traders: WhaleTraderResult[],
): Promise<void> {
  if (traders.length === 0) return;

  const lines = traders.map((t, i) => {
    const addr = t.walletAddress.length > 10
      ? `${t.walletAddress.slice(0, 6)}…${t.walletAddress.slice(-4)}`
      : t.walletAddress;
    const wr = t.winRate != null ? `  WR ${t.winRate.toFixed(0)}%` : '';
    const alloc = t.allocationPct != null ? `  Alloc ${t.allocationPct.toFixed(1)}%` : '';
    const cons = t.consistency ? `  ${t.consistency}` : '';
    return `**${i + 1}.** \`${addr}\`  Score **${t.score.toFixed(0)}**${wr}${alloc}${cons}`;
  });

  const embed = {
    title: `🐋  Whale Tracker  ·  Top ${traders.length} Traders`,
    description: lines.join('\n'),
    color: COLOR.WHALE,
    footer: { text: `Whale Signals  ·  30d performance  ·  ${new Date().toUTCString()}` },
    timestamp: new Date().toISOString(),
  };

  await sendWebhook(webhookUrl, { embeds: [embed] });
  logger.info({ count: traders.length }, 'Posted whale snapshot to Discord');
}

// ─── Telegram: Trade Setups ────────────────────────────────────────────────────

export async function postOpportunitySignalsToTelegram(
  botToken: string,
  chatId: string,
  opportunities: OpportunityResult[],
  btcContext?: { price: number; trend: string; change1h: number; change24h: number } | null,
): Promise<void> {
  if (opportunities.length === 0) return;

  const telegram = new TelegramService(botToken, chatId);

  const signalLines = opportunities.map(o => {
    const dir = o.direction === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
    const delta =
      o.scoreDelta > 0.5 ? ` ↑${o.scoreDelta.toFixed(1)}` :
      o.scoreDelta < -0.5 ? ` ↓${Math.abs(o.scoreDelta).toFixed(1)}` : '';
    const streak = o.scanStreak > 1 ? ` 🔥×${o.scanStreak}` : '';
    return `${dir} <b>${escapeHtml(o.asset)}</b> ×${o.leverage}  Score: <b>${o.finalScore.toFixed(1)}</b>${delta}${streak}`;
  });

  const pillarLines = opportunities.slice(0, 5).map(o => {
    const p = o.pillarScores;
    return `<b>${escapeHtml(o.asset)}</b>  SM <code>${p.smartMoney.toFixed(0)}</code>  Str <code>${p.marketStructure.toFixed(0)}</code>  Tech <code>${p.technicals.toFixed(0)}</code>  Fund <code>${p.funding.toFixed(0)}</code>`;
  });

  const btcLine = btcContext
    ? `BTC $${btcContext.price.toLocaleString()}  ·  ${escapeHtml(btcContext.trend)}  ·  1H: ${btcContext.change1h >= 0 ? '+' : ''}${btcContext.change1h.toFixed(2)}%`
    : '';

  const message = [
    `🎯 <b>Trade Setups · ${opportunities.length} signal${opportunities.length !== 1 ? 's' : ''}</b>`,
    '━━━━━━━━━━',
    ...signalLines,
    btcLine ? `\n${btcLine}` : '',
    '━━━━━━━━━━',
    ...pillarLines,
    '',
    `<i>${new Date().toUTCString()}</i>`,
  ].filter(Boolean).join('\n');

  await telegram.sendHtmlMessage(message);
  logger.info({ count: opportunities.length }, 'Posted opportunity signals to Telegram');
}

// ─── Telegram: Whale Snapshot ──────────────────────────────────────────────────

export async function postWhaleSnapshotToTelegram(
  botToken: string,
  chatId: string,
  traders: WhaleTraderResult[],
): Promise<void> {
  if (traders.length === 0) return;

  const telegram = new TelegramService(botToken, chatId);

  const lines = traders.map((t, i) => {
    const addr = t.walletAddress.length > 10
      ? `${t.walletAddress.slice(0, 6)}…${t.walletAddress.slice(-4)}`
      : t.walletAddress;
    const wr = t.winRate != null ? `  WR ${t.winRate.toFixed(0)}%` : '';
    const alloc = t.allocationPct != null ? `  Alloc ${t.allocationPct.toFixed(1)}%` : '';
    const cons = t.consistency ? `  ${escapeHtml(t.consistency)}` : '';
    return `<b>${i + 1}.</b> <code>${escapeHtml(addr)}</code>  Score <b>${t.score.toFixed(0)}</b>${wr}${alloc}${cons}`;
  });

  const message = [
    `🐋 <b>Whale Tracker · Top ${traders.length} Traders</b>`,
    '━━━━━━━━━━',
    ...lines,
    '',
    `<i>30d performance · ${new Date().toUTCString()}</i>`,
  ].join('\n');

  await telegram.sendHtmlMessage(message);
  logger.info({ count: traders.length }, 'Posted whale snapshot to Telegram');
}
