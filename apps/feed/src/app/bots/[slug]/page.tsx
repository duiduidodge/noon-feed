import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getBotDescription } from '@/lib/bot-descriptions';
import { BotTerminal } from '@/components/bot-terminal';

export const dynamic = 'force-dynamic';

async function loadBotData(slug: string) {
  const bot = await prisma.botAgent.findUnique({
    where: { slug },
    include: {
      metrics: {
        orderBy: { observedAt: 'desc' },
        take: 1,
      },
      positions: {
        where: { status: 'OPEN' },
        orderBy: { snapshotTime: 'desc' },
      },
      events: {
        orderBy: { eventAt: 'desc' },
        take: 20,
      },
    },
  });
  return bot;
}

export default async function BotPage({ params }: { params: { slug: string } }) {
  const bot = await loadBotData(params.slug).catch(() => null);

  if (!bot) notFound();

  const staleCutoff = new Date(Date.now() - 10 * 60 * 1000);
  const latestMetric = bot.metrics[0] ?? null;
  const description = getBotDescription(bot.slug);

  const botData = {
    id: bot.id,
    slug: bot.slug,
    name: bot.name,
    environment: bot.environment,
    category: bot.category,
    strategyFamily: bot.strategyFamily ?? description?.tags.join(' · ') ?? null,
    venue: bot.venue ?? description?.tags.at(-1) ?? null,
    repoUrl: bot.repoUrl,
    dashboardUrl: bot.dashboardUrl,
    status: bot.status,
    isEnabled: bot.isEnabled,
    lastHeartbeatAt: bot.lastHeartbeatAt,
    freshness:
      bot.lastHeartbeatAt && bot.lastHeartbeatAt >= staleCutoff
        ? ('LIVE' as const)
        : ('STALE' as const),
    latestMetric: latestMetric
      ? {
          equityUsd: latestMetric.equityUsd?.toNumber() ?? null,
          cashUsd: latestMetric.cashUsd?.toNumber() ?? null,
          realizedPnlUsd: latestMetric.realizedPnlUsd?.toNumber() ?? null,
          unrealizedPnlUsd: latestMetric.unrealizedPnlUsd?.toNumber() ?? null,
          dailyPnlUsd: latestMetric.dailyPnlUsd?.toNumber() ?? null,
          drawdownPct: latestMetric.drawdownPct?.toNumber() ?? null,
          winRatePct: latestMetric.winRatePct?.toNumber() ?? null,
          openPositions: latestMetric.openPositions ?? null,
          observedAt: latestMetric.observedAt,
        }
      : null,
    positions: bot.positions.map((p) => ({
      id: p.id,
      symbol: p.symbol,
      side: p.side,
      quantity: p.quantity?.toNumber() ?? null,
      entryPrice: p.entryPrice?.toNumber() ?? null,
      markPrice: p.markPrice?.toNumber() ?? null,
      pnlUsd: p.pnlUsd?.toNumber() ?? null,
      pnlPct: p.pnlPct?.toNumber() ?? null,
      openedAt: p.openedAt,
    })),
    events: bot.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      severity: e.severity,
      title: e.title,
      body: e.body,
      symbol: e.symbol,
      eventAt: e.eventAt,
    })),
  };

  return <BotTerminal bot={botData} description={description} />;
}
