import { HubCommandCenter } from '@/components/hub-command-center';
import { prisma } from '@/lib/prisma';
import { getBotDescription } from '@/lib/bot-descriptions';

export const dynamic = 'force-dynamic';

async function loadHubData(dayCutoff: Date) {
  return Promise.all([
    prisma.botAgent.findMany({
      include: {
        metrics: {
          orderBy: { observedAt: 'desc' },
          take: 1,
        },
        positions: {
          where: { status: 'OPEN' },
          orderBy: { snapshotTime: 'desc' },
          take: 5,
        },
      },
      orderBy: [{ isEnabled: 'desc' }, { updatedAt: 'desc' }],
    }),
    prisma.botEvent.findMany({
      include: {
        bot: {
          select: { slug: true, name: true },
        },
      },
      orderBy: { eventAt: 'desc' },
      take: 10,
    }),
    prisma.article.count({
      where: {
        publishedAt: { gte: dayCutoff },
        status: { in: ['FETCHED', 'ENRICHED'] },
      },
    }),
    prisma.opportunitySnapshot.findFirst({ orderBy: { scanTime: 'desc' } }),
    prisma.emergingMoverSnapshot.findFirst({ orderBy: { signalTime: 'desc' } }),
    prisma.whaleSnapshot.findFirst({ orderBy: { scanTime: 'desc' } }),
  ]);
}

export default async function HubPage() {
  const now = Date.now();
  const staleCutoff = new Date(now - 10 * 60 * 1000);
  const dayCutoff = new Date(now - 24 * 60 * 60 * 1000);
  let loadWarning: string | null = null;
  let bots: Awaited<ReturnType<typeof loadHubData>>[0] = [];
  let events: Awaited<ReturnType<typeof loadHubData>>[1] = [];
  let articleCount24h = 0;
  let latestOpportunity: Awaited<ReturnType<typeof loadHubData>>[3] = null;
  let latestEmerging: Awaited<ReturnType<typeof loadHubData>>[4] = null;
  let latestWhales: Awaited<ReturnType<typeof loadHubData>>[5] = null;

  try {
    [bots, events, articleCount24h, latestOpportunity, latestEmerging, latestWhales] = await loadHubData(dayCutoff);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database connection unavailable.';
    loadWarning = message.split('\n')[0];
  }

  const fleet = bots.map((bot) => {
    const latestMetric = bot.metrics[0] ?? null;
    const openPositions = bot.positions.length;

    return {
      id: bot.id,
      slug: bot.slug,
      name: bot.name,
      environment: bot.environment,
      category: bot.category,
      strategyFamily: bot.strategyFamily ?? getBotDescription(bot.slug)?.tags.join(' · ') ?? null,
      venue: bot.venue,
      status: bot.status,
      isEnabled: bot.isEnabled,
      lastHeartbeatAt: bot.lastHeartbeatAt,
      freshness: bot.lastHeartbeatAt && bot.lastHeartbeatAt >= staleCutoff ? 'LIVE' as const : 'STALE' as const,
      latestMetric: latestMetric
        ? {
            equityUsd: latestMetric.equityUsd?.toNumber() ?? null,
            dailyPnlUsd: latestMetric.dailyPnlUsd?.toNumber() ?? null,
            drawdownPct: latestMetric.drawdownPct?.toNumber() ?? null,
            openPositions: latestMetric.openPositions ?? openPositions,
            observedAt: latestMetric.observedAt,
          }
        : null,
      openPositions,
    };
  });

  const summary = {
    totalBots: fleet.length,
    liveBots: fleet.filter((bot) => bot.freshness === 'LIVE').length,
    staleBots: fleet.filter((bot) => bot.freshness === 'STALE').length,
    enabledBots: fleet.filter((bot) => bot.isEnabled).length,
    openPositions: fleet.reduce((sum, bot) => sum + bot.openPositions, 0),
    aggregateDailyPnlUsd: fleet.reduce((sum, bot) => sum + (bot.latestMetric?.dailyPnlUsd ?? 0), 0),
    aggregateEquityUsd: fleet.reduce((sum, bot) => sum + (bot.latestMetric?.equityUsd ?? 0), 0),
    articleCount24h,
    signals: {
      opportunitiesAt: latestOpportunity?.scanTime ?? null,
      emergingAt: latestEmerging?.signalTime ?? null,
      whalesAt: latestWhales?.scanTime ?? null,
    },
  };

  return (
    <HubCommandCenter
      summary={summary}
      fleet={fleet}
      loadWarning={loadWarning}
      events={events.map((event) => ({
        id: event.id,
        botSlug: event.bot.slug,
        botName: event.bot.name,
        eventType: event.eventType,
        severity: event.severity,
        title: event.title,
        body: event.body,
        symbol: event.symbol,
        eventAt: event.eventAt,
      }))}
    />
  );
}
