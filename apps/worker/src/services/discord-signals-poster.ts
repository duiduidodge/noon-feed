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

async function sendWebhook(webhookUrl: string, body: object, imageBuffer?: Buffer): Promise<void> {
  if (imageBuffer) {
    // Use FormData to attach the chart image
    const formData = new FormData();
    formData.append('payload_json', JSON.stringify(body));
    formData.append('files[0]', new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' }), 'chart.png');

    const res = await fetch(webhookUrl, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Discord ${res.status}: ${await res.text()}`);
    }
  } else {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Discord ${res.status}: ${await res.text()}`);
    }
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
      value: `Deriv \`${p.derivatives.toFixed(0)}\`  Struct \`${p.marketStructure.toFixed(0)}\`  Tech \`${p.technicals.toFixed(0)}\``,
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

// ─── Watchlist Alerts ──────────────────────────────────────────────────────────

import type { WatchlistEvent } from './watchlist-manager.js';

export async function postWatchlistEvents(
  webhookUrl: string,
  events: WatchlistEvent[],
): Promise<void> {
  for (const event of events) {
    const embed = buildWatchlistEmbed(event);
    const chartBuffer = 'signal' in event && event.signal.chartImageBase64
      ? Buffer.from(event.signal.chartImageBase64, 'base64')
      : undefined;

    // If chart image attached, reference it in the embed
    if (chartBuffer) {
      (embed as any).image = { url: 'attachment://chart.png' };
    }

    await sendWebhook(webhookUrl, { embeds: [embed] }, chartBuffer);
    logger.info({ type: event.type, asset: event.entry.asset }, 'Posted watchlist event to Discord');
  }
}

export async function postWatchlistEventsToTelegram(
  botToken: string,
  chatId: string,
  events: WatchlistEvent[],
): Promise<void> {
  const telegram = new TelegramService(botToken, chatId);
  for (const event of events) {
    const message = buildWatchlistTelegramMessage(event);
    await telegram.sendHtmlMessage(message);
    logger.info({ type: event.type, asset: event.entry.asset }, 'Posted watchlist event to Telegram');
  }
}

function tvChartUrl(asset: string): string {
  return `https://www.tradingview.com/chart/?symbol=BINANCE:${asset}USDTPERP&interval=D`;
}

function buildWatchlistEmbed(event: WatchlistEvent): object {
  const { entry } = event;
  const isLong = entry.direction === 'LONG';
  const dirLabel = isLong ? '🟢 LONG' : '🔴 SHORT';

  switch (event.type) {
    case 'NEW': {
      const swing = event.signal.swingGrade;
      const volTag = event.signal.volumeSpike ? '  📊 **Vol Spike**' : '';
      const regimeTag = buildRegimeTag(event.signal);
      const tech = event.signal.technicals as Record<string, unknown>;
      const fields = [
        ...buildPillarFields(event.signal),
        ...buildExitFields(event.signal),
        ...buildThesisField(event.signal),
        ...(swing ? buildSwingFields(tech) : []),
      ];
      return {
        title: swing
          ? `🎯  Swing Setup: ${entry.asset}`
          : `🆕  New Setup: ${entry.asset}`,
        url: swing ? tvChartUrl(entry.asset) : undefined,
        description: `${dirLabel}  ·  Score: **${entry.lastScore}**${regimeTag}${swing ? '  ·  Daily confirmed' : ''}${volTag}`,
        color: isLong ? COLOR.LONG : COLOR.SHORT,
        fields,
        footer: { text: `Watchlist · ${swing ? 'Swing · ' : ''}Added  ·  ${new Date().toUTCString()}` },
        timestamp: new Date().toISOString(),
      };
    }
    case 'FLIP': {
      const swing = event.signal.swingGrade;
      const regimeTag = buildRegimeTag(event.signal);
      const prevLabel = event.prevDirection === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
      return {
        title: swing
          ? `🎯🔄  Swing Flip: ${entry.asset}`
          : `🔄  Direction Flip: ${entry.asset}`,
        url: swing ? tvChartUrl(entry.asset) : undefined,
        description: `${prevLabel} → ${dirLabel}  ·  Score: **${entry.lastScore}**${regimeTag}`,
        color: COLOR.MIXED,
        fields: [...buildPillarFields(event.signal), ...buildExitFields(event.signal), ...buildThesisField(event.signal)],
        footer: { text: `Watchlist · Flip  ·  ${new Date().toUTCString()}` },
        timestamp: new Date().toISOString(),
      };
    }
    case 'SURGE': {
      const swing = event.signal.swingGrade;
      const volTag = event.signal.volumeSpike ? '  📊 **Vol Spike**' : '';
      const regimeTag = buildRegimeTag(event.signal);
      const delta = entry.lastScore - event.prevScore;
      return {
        title: swing
          ? `🎯🔥  Swing Conviction: ${entry.asset}`
          : `🔥  Conviction Rising: ${entry.asset}`,
        url: swing ? tvChartUrl(entry.asset) : undefined,
        description: `${dirLabel}  ·  Score: **${event.prevScore}** → **${entry.lastScore}**  (${delta > 0 ? '+' : ''}${delta})${regimeTag}${volTag}`,
        color: isLong ? COLOR.LONG : COLOR.SHORT,
        fields: [...buildPillarFields(event.signal), ...buildExitFields(event.signal), ...buildThesisField(event.signal)],
        footer: { text: `Watchlist · Surge  ·  ${new Date().toUTCString()}` },
        timestamp: new Date().toISOString(),
      };
    }
    case 'CLOSED': {
      const duration = entry.closedAt
        ? Math.round((entry.closedAt.getTime() - entry.addedAt.getTime()) / 60000)
        : null;
      const reasonLabel = entry.exitReason === 'TIME_EXIT' ? '  ·  ⏱ Time exit' : '';
      return {
        title: `❌  Setup Closed: ${entry.asset}`,
        description: `${dirLabel}  ·  Entry: **${entry.entryScore}**  →  Exit: **${entry.lastScore}**${duration !== null ? `  ·  ${duration}m` : ''}${reasonLabel}`,
        color: 0x546e7a,
        footer: { text: `Watchlist · Closed  ·  ${new Date().toUTCString()}` },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

function buildThesisField(signal: OpportunityResult): object[] {
  if (!signal.thesis || signal.thesis.length === 0) return [];
  return [{
    name: '\uD83D\uDCCB Thesis',
    value: signal.thesis.map(b => `\u2022 ${b}`).join('\n'),
    inline: false,
  }];
}

function buildPillarFields(signal: OpportunityResult): object[] {
  const p = signal.pillarScores;
  if (!p) return [];
  return [{
    name: 'Pillars',
    value: `Deriv \`${p.derivatives.toFixed(0)}\`  Struct \`${p.marketStructure.toFixed(0)}\`  Tech \`${p.technicals.toFixed(0)}\``,
    inline: false,
  }];
}

function fmtPrice(v: number): string {
  if (v >= 10000) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (v >= 1)     return `$${v.toFixed(2)}`;
  return `$${v.toFixed(5)}`;
}

function buildRegimeTag(signal: OpportunityResult): string {
  const regime = signal.regime;
  if (!regime) return '';
  const adx = (signal.technicals as Record<string, unknown>).adx4h;
  const adxStr = typeof adx === 'number' ? ` ADX ${adx.toFixed(0)}` : '';
  const icon = regime === 'TRENDING' ? '📈' : regime === 'VOLATILE' ? '⚡' : '↔️';
  return `  ·  ${icon} ${regime}${adxStr}`;
}

function buildExitFields(signal: OpportunityResult): object[] {
  const el = signal.exitLevels;
  if (!el) return [];
  return [{
    name: 'Exit Plan',
    value: `SL \`${fmtPrice(el.initialSL)}\`  TP1 \`${fmtPrice(el.tp1)}\`  TP2 \`${fmtPrice(el.tp2)}\`  ·  Risk \`${el.riskPct.toFixed(1)}%\`  ·  Max \`${el.maxHoldHours}h\``,
    inline: false,
  }];
}

function buildSwingFields(tech: Record<string, unknown>): object[] {
  const fields: object[] = [];
  const parts: string[] = [];
  if (tech.trendDaily) parts.push(`Daily ${tech.trendDaily}`);
  if (typeof tech.rsi1d === 'number') parts.push(`RSI1D \`${(tech.rsi1d as number).toFixed(1)}\``);
  if (parts.length > 0) fields.push({ name: 'Daily Context', value: parts.join('  ·  '), inline: false });

  const wp = tech.weeklyPivots as Record<string, number> | null | undefined;
  if (wp && (wp.s1 || wp.r1)) {
    const fmt = (v: number) => v >= 1000 ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`;
    fields.push({
      name: 'Weekly Pivots',
      value: [
        wp.s2 != null ? `S2 \`${fmt(wp.s2)}\`` : null,
        wp.s1 != null ? `S1 \`${fmt(wp.s1)}\`` : null,
        wp.pp != null ? `PP \`${fmt(wp.pp)}\`` : null,
        wp.r1 != null ? `R1 \`${fmt(wp.r1)}\`` : null,
        wp.r2 != null ? `R2 \`${fmt(wp.r2)}\`` : null,
      ].filter(Boolean).join('  '),
      inline: false,
    });
  }
  return fields;
}

function buildWatchlistTelegramMessage(event: WatchlistEvent): string {
  const { entry } = event;
  const isLong = entry.direction === 'LONG';
  const dirLabel = isLong ? '🟢 LONG' : '🔴 SHORT';
  const asset = escapeHtml(entry.asset);

  switch (event.type) {
    case 'NEW': {
      const swing = event.signal.swingGrade;
      const volTag = event.signal.volumeSpike ? '  📊 <b>Vol Spike</b>' : '';
      const tech = event.signal.technicals as Record<string, unknown>;
      const chartLink = swing
        ? `\n📊 <a href="${tvChartUrl(entry.asset)}">Daily Chart</a>`
        : '';
      const swingLine = swing && typeof tech.rsi1d === 'number'
        ? `\nDaily: <b>${tech.trendDaily}</b>  ·  RSI1D: <b>${(tech.rsi1d as number).toFixed(1)}</b>`
        : '';
      const el = event.signal.exitLevels;
      const exitLine = el
        ? `\nSL <code>${fmtPrice(el.initialSL)}</code>  TP1 <code>${fmtPrice(el.tp1)}</code>  TP2 <code>${fmtPrice(el.tp2)}</code>  Risk <b>${el.riskPct.toFixed(1)}%</b>  Max <b>${el.maxHoldHours}h</b>`
        : '';
      const regimeLine = event.signal.regime
        ? `  ·  ${event.signal.regime === 'TRENDING' ? '📈' : event.signal.regime === 'VOLATILE' ? '⚡' : '↔️'} ${event.signal.regime}`
        : '';
      const thesisLine = event.signal.thesis && event.signal.thesis.length > 0
        ? `\n\n📋 <b>Thesis</b>\n${event.signal.thesis.map(b => `• ${escapeHtml(b)}`).join('\n')}`
        : '';
      return [
        swing ? `🎯 <b>Swing Setup: ${asset}</b>` : `🆕 <b>New Setup: ${asset}</b>`,
        `${dirLabel}  ·  Score: <b>${entry.lastScore}</b>${regimeLine}${volTag}${swingLine}${exitLine}${thesisLine}${chartLink}`,
        `<i>${new Date().toUTCString()}</i>`,
      ].join('\n');
    }
    case 'FLIP': {
      const swing = event.signal.swingGrade;
      const prevLabel = event.prevDirection === 'LONG' ? '🟢 LONG' : '🔴 SHORT';
      const chartLink = swing ? `\n📊 <a href="${tvChartUrl(entry.asset)}">Daily Chart</a>` : '';
      const el = event.signal.exitLevels;
      const exitLine = el
        ? `\nSL <code>${fmtPrice(el.initialSL)}</code>  TP1 <code>${fmtPrice(el.tp1)}</code>  TP2 <code>${fmtPrice(el.tp2)}</code>`
        : '';
      const thesisLine = event.signal.thesis && event.signal.thesis.length > 0
        ? `\n\n📋 <b>Thesis</b>\n${event.signal.thesis.map(b => `• ${escapeHtml(b)}`).join('\n')}`
        : '';
      return [
        swing ? `🎯🔄 <b>Swing Flip: ${asset}</b>` : `🔄 <b>Direction Flip: ${asset}</b>`,
        `${prevLabel} → ${dirLabel}  ·  Score: <b>${entry.lastScore}</b>${exitLine}${thesisLine}${chartLink}`,
        `<i>${new Date().toUTCString()}</i>`,
      ].join('\n');
    }
    case 'SURGE': {
      const swing = event.signal.swingGrade;
      const volTag = event.signal.volumeSpike ? '  📊 <b>Vol Spike</b>' : '';
      const delta = entry.lastScore - event.prevScore;
      const chartLink = swing ? `\n📊 <a href="${tvChartUrl(entry.asset)}">Daily Chart</a>` : '';
      const thesisLine = event.signal.thesis && event.signal.thesis.length > 0
        ? `\n\n📋 <b>Thesis</b>\n${event.signal.thesis.map(b => `• ${escapeHtml(b)}`).join('\n')}`
        : '';
      return [
        swing ? `🎯🔥 <b>Swing Conviction: ${asset}</b>` : `🔥 <b>Conviction Rising: ${asset}</b>`,
        `${dirLabel}  ·  Score: <b>${event.prevScore}</b> → <b>${entry.lastScore}</b>  (${delta > 0 ? '+' : ''}${delta})${volTag}${thesisLine}${chartLink}`,
        `<i>${new Date().toUTCString()}</i>`,
      ].join('\n');
    }
    case 'CLOSED': {
      const duration = entry.closedAt
        ? Math.round((entry.closedAt.getTime() - entry.addedAt.getTime()) / 60000)
        : null;
      const reasonLabel = entry.exitReason === 'TIME_EXIT' ? '  ·  ⏱ Time exit' : '';
      return [
        `❌ <b>Setup Closed: ${asset}</b>`,
        `${dirLabel}  ·  Entry: <b>${entry.entryScore}</b>  →  Exit: <b>${entry.lastScore}</b>${duration !== null ? `  ·  ${duration}m` : ''}${reasonLabel}`,
        `<i>${new Date().toUTCString()}</i>`,
      ].join('\n');
    }
  }
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
    return `<b>${escapeHtml(o.asset)}</b>  Deriv <code>${p.derivatives.toFixed(0)}</code>  Struct <code>${p.marketStructure.toFixed(0)}</code>  Tech <code>${p.technicals.toFixed(0)}</code>`;
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
