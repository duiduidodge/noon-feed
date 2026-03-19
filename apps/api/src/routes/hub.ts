import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type JsonRecord = Record<string, unknown>;

function parseObjectBody(body: unknown): JsonRecord | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return body as JsonRecord;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function requireIngestKey(request: FastifyRequest, reply: FastifyReply): boolean {
  const expectedKey = process.env.NOON_HUB_INGEST_KEY;
  if (!expectedKey) return true;

  const providedKey = request.headers['x-noon-hub-key'];
  if (providedKey === expectedKey) return true;

  reply.status(401).send({ error: 'Unauthorized' });
  return false;
}

function extractBotId(result: Awaited<ReturnType<typeof upsertBot>>) {
  if ('error' in result) {
    throw new Error(result.error);
  }

  return result.bot.id;
}

async function upsertBot(fastify: FastifyInstance, payload: JsonRecord) {
  const slug = asString(payload.slug);
  const name = asString(payload.name);

  if (!slug || !name) {
    return { error: 'slug and name are required' };
  }

  const bot = await fastify.prisma.botAgent.upsert({
    where: { slug },
    update: {
      name,
      environment: asString(payload.environment) ?? 'production',
      category: asString(payload.category) ?? null,
      strategyFamily: asString(payload.strategyFamily) ?? null,
      venue: asString(payload.venue) ?? null,
      repoUrl: asString(payload.repoUrl) ?? null,
      dashboardUrl: asString(payload.dashboardUrl) ?? null,
      status: asString(payload.status) ?? 'UNKNOWN',
      isEnabled: asOptionalBoolean(payload.isEnabled) ?? true,
      metadata: payload.metadata ?? undefined,
      lastHeartbeatAt: asDate(payload.lastHeartbeatAt) ?? undefined,
    },
    create: {
      slug,
      name,
      environment: asString(payload.environment) ?? 'production',
      category: asString(payload.category) ?? null,
      strategyFamily: asString(payload.strategyFamily) ?? null,
      venue: asString(payload.venue) ?? null,
      repoUrl: asString(payload.repoUrl) ?? null,
      dashboardUrl: asString(payload.dashboardUrl) ?? null,
      status: asString(payload.status) ?? 'UNKNOWN',
      isEnabled: asOptionalBoolean(payload.isEnabled) ?? true,
      metadata: payload.metadata ?? undefined,
      lastHeartbeatAt: asDate(payload.lastHeartbeatAt) ?? undefined,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      environment: true,
      venue: true,
      strategyFamily: true,
      lastHeartbeatAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return { bot };
}

export async function hubRoutes(fastify: FastifyInstance) {
  fastify.get('/overview', async () => {
    const now = Date.now();
    const staleCutoff = new Date(now - 10 * 60 * 1000);
    const dayCutoff = new Date(now - 24 * 60 * 60 * 1000);

    const [bots, latestEvents, articleCount24h, latestOpportunity, latestEmerging, latestWhales] = await Promise.all([
      fastify.prisma.botAgent.findMany({
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
      fastify.prisma.botEvent.findMany({
        include: {
          bot: {
            select: { slug: true, name: true },
          },
        },
        orderBy: { eventAt: 'desc' },
        take: 12,
      }),
      fastify.prisma.article.count({
        where: {
          publishedAt: { gte: dayCutoff },
          status: { in: ['FETCHED', 'ENRICHED'] },
        },
      }),
      fastify.prisma.opportunitySnapshot.findFirst({ orderBy: { scanTime: 'desc' } }),
      fastify.prisma.emergingMoverSnapshot.findFirst({ orderBy: { signalTime: 'desc' } }),
      fastify.prisma.whaleSnapshot.findFirst({ orderBy: { scanTime: 'desc' } }),
    ]);

    const fleet = bots.map((bot) => {
      const latestMetric = bot.metrics[0] ?? null;
      const openPositions = bot.positions.length;
      return {
        id: bot.id,
        slug: bot.slug,
        name: bot.name,
        environment: bot.environment,
        category: bot.category,
        strategyFamily: bot.strategyFamily,
        venue: bot.venue,
        status: bot.status,
        isEnabled: bot.isEnabled,
        lastHeartbeatAt: bot.lastHeartbeatAt,
        freshness: bot.lastHeartbeatAt && bot.lastHeartbeatAt >= staleCutoff ? 'LIVE' : 'STALE',
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

    return {
      generatedAt: new Date().toISOString(),
      summary,
      fleet,
      events: latestEvents.map((event) => ({
        id: event.id,
        botSlug: event.bot.slug,
        botName: event.bot.name,
        eventType: event.eventType,
        severity: event.severity,
        title: event.title,
        body: event.body,
        symbol: event.symbol,
        eventAt: event.eventAt,
      })),
    };
  });

  fastify.get('/bots', async () => {
    const bots = await fastify.prisma.botAgent.findMany({
      include: {
        heartbeats: {
          orderBy: { observedAt: 'desc' },
          take: 1,
        },
        metrics: {
          orderBy: { observedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ isEnabled: 'desc' }, { updatedAt: 'desc' }],
    });

    return {
      items: bots.map((bot) => ({
        id: bot.id,
        slug: bot.slug,
        name: bot.name,
        environment: bot.environment,
        category: bot.category,
        strategyFamily: bot.strategyFamily,
        venue: bot.venue,
        status: bot.status,
        isEnabled: bot.isEnabled,
        repoUrl: bot.repoUrl,
        dashboardUrl: bot.dashboardUrl,
        lastHeartbeatAt: bot.lastHeartbeatAt,
        latestHeartbeat: bot.heartbeats[0] ?? null,
        latestMetric: bot.metrics[0]
          ? {
              equityUsd: bot.metrics[0].equityUsd?.toNumber() ?? null,
              dailyPnlUsd: bot.metrics[0].dailyPnlUsd?.toNumber() ?? null,
              drawdownPct: bot.metrics[0].drawdownPct?.toNumber() ?? null,
              openPositions: bot.metrics[0].openPositions ?? null,
              observedAt: bot.metrics[0].observedAt,
            }
          : null,
      })),
    };
  });

  fastify.post('/bots/register', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireIngestKey(request, reply)) return;

    const payload = parseObjectBody(request.body);
    if (!payload) {
      return reply.status(400).send({ error: 'Invalid JSON body' });
    }

    const result = await upsertBot(fastify, payload);
    if ('error' in result) {
      return reply.status(400).send(result);
    }

    return reply.status(201).send(result);
  });

  fastify.post('/heartbeat', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireIngestKey(request, reply)) return;

    const payload = parseObjectBody(request.body);
    if (!payload) {
      return reply.status(400).send({ error: 'Invalid JSON body' });
    }

    const botSlug = asString(payload.botSlug);
    if (!botSlug) {
      return reply.status(400).send({ error: 'botSlug is required' });
    }

    const status = asString(payload.status) ?? 'UNKNOWN';
    const observedAt = asDate(payload.observedAt) ?? new Date();
    const botName = asString(payload.name) ?? botSlug;

    const botResult = await upsertBot(fastify, {
      slug: botSlug,
      name: botName,
      environment: payload.environment,
      category: payload.category,
      strategyFamily: payload.strategyFamily,
      venue: payload.venue,
      repoUrl: payload.repoUrl,
      dashboardUrl: payload.dashboardUrl,
      status,
      isEnabled: payload.isEnabled,
      metadata: payload.metadata,
      lastHeartbeatAt: observedAt.toISOString(),
    });
    const botId = extractBotId(botResult);

    await fastify.prisma.botHeartbeat.create({
      data: {
        botId,
        status,
        message: asString(payload.message) ?? null,
        version: asString(payload.version) ?? null,
        latencyMs: asOptionalNumber(payload.latencyMs),
        uptimeSec: asOptionalNumber(payload.uptimeSec),
        metadata: payload.metadata ?? undefined,
        observedAt,
      },
    });

    return { ok: true, botId, observedAt: observedAt.toISOString() };
  });

  fastify.post('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireIngestKey(request, reply)) return;

    const payload = parseObjectBody(request.body);
    if (!payload) {
      return reply.status(400).send({ error: 'Invalid JSON body' });
    }

    const botSlug = asString(payload.botSlug);
    const name = asString(payload.name) ?? botSlug;
    if (!botSlug || !name) {
      return reply.status(400).send({ error: 'botSlug and name are required' });
    }

    const observedAt = asDate(payload.observedAt) ?? new Date();
    const botResult = await upsertBot(fastify, {
      slug: botSlug,
      name,
      environment: payload.environment,
      category: payload.category,
      strategyFamily: payload.strategyFamily,
      venue: payload.venue,
      status: payload.status,
      lastHeartbeatAt: payload.status ? observedAt.toISOString() : undefined,
    });
    const botId = extractBotId(botResult);

    await fastify.prisma.botMetricSnapshot.create({
      data: {
        botId,
        equityUsd: asOptionalNumber(payload.equityUsd),
        cashUsd: asOptionalNumber(payload.cashUsd),
        realizedPnlUsd: asOptionalNumber(payload.realizedPnlUsd),
        unrealizedPnlUsd: asOptionalNumber(payload.unrealizedPnlUsd),
        dailyPnlUsd: asOptionalNumber(payload.dailyPnlUsd),
        drawdownPct: asOptionalNumber(payload.drawdownPct),
        winRatePct: asOptionalNumber(payload.winRatePct),
        openPositions: asOptionalNumber(payload.openPositions),
        metadata: payload.metadata ?? undefined,
        observedAt,
      },
    });

    return { ok: true, botId, observedAt: observedAt.toISOString() };
  });

  fastify.post('/positions', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireIngestKey(request, reply)) return;

    const payload = parseObjectBody(request.body);
    if (!payload) {
      return reply.status(400).send({ error: 'Invalid JSON body' });
    }

    const botSlug = asString(payload.botSlug);
    const name = asString(payload.name) ?? botSlug;
    if (!botSlug || !name) {
      return reply.status(400).send({ error: 'botSlug and name are required' });
    }

    const positions = Array.isArray(payload.positions) ? payload.positions.filter(parseObjectBody) as JsonRecord[] : [];
    if (positions.length === 0) {
      return reply.status(400).send({ error: 'positions array is required' });
    }

    const snapshotTime = asDate(payload.snapshotTime) ?? new Date();
    const botResult = await upsertBot(fastify, {
      slug: botSlug,
      name,
      environment: payload.environment,
      category: payload.category,
      strategyFamily: payload.strategyFamily,
      venue: payload.venue,
      status: payload.status,
      lastHeartbeatAt: payload.status ? snapshotTime.toISOString() : undefined,
    });
    const botId = extractBotId(botResult);

    await fastify.prisma.$transaction([
      fastify.prisma.botPositionSnapshot.deleteMany({
        where: {
          botId,
          status: 'OPEN',
        },
      }),
      fastify.prisma.botPositionSnapshot.createMany({
        data: positions.map((position) => ({
          botId,
          symbol: asString(position.symbol) ?? 'UNKNOWN',
          side: asString(position.side) ?? 'UNKNOWN',
          status: asString(position.status) ?? 'OPEN',
          quantity: asOptionalNumber(position.quantity),
          entryPrice: asOptionalNumber(position.entryPrice),
          markPrice: asOptionalNumber(position.markPrice),
          pnlUsd: asOptionalNumber(position.pnlUsd),
          pnlPct: asOptionalNumber(position.pnlPct),
          openedAt: asDate(position.openedAt),
          closedAt: asDate(position.closedAt),
          metadata: position.metadata ?? undefined,
          snapshotTime,
        })),
      }),
    ]);

    return { ok: true, botId, positions: positions.length, snapshotTime: snapshotTime.toISOString() };
  });

  fastify.post('/events', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireIngestKey(request, reply)) return;

    const payload = parseObjectBody(request.body);
    if (!payload) {
      return reply.status(400).send({ error: 'Invalid JSON body' });
    }

    const botSlug = asString(payload.botSlug);
    const name = asString(payload.name) ?? botSlug;
    if (!botSlug || !name) {
      return reply.status(400).send({ error: 'botSlug and name are required' });
    }

    const botResult = await upsertBot(fastify, {
      slug: botSlug,
      name,
      environment: payload.environment,
      category: payload.category,
      strategyFamily: payload.strategyFamily,
      venue: payload.venue,
      status: payload.status,
      lastHeartbeatAt: payload.status ? new Date().toISOString() : undefined,
    });
    const botId = extractBotId(botResult);

    const eventAt = asDate(payload.eventAt) ?? new Date();
    const event = await fastify.prisma.botEvent.create({
      data: {
        botId,
        eventType: asString(payload.eventType) ?? 'generic',
        severity: asString(payload.severity) ?? 'INFO',
        title: asString(payload.title) ?? 'Untitled event',
        body: asString(payload.body) ?? null,
        symbol: asString(payload.symbol) ?? null,
        payload: payload.payload ?? undefined,
        eventAt,
      },
    });

    return { ok: true, eventId: event.id };
  });
}
