import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { clusterDuplicateStories } from '@crypto-news/shared';

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function ageHours(date: Date | null): number | null {
  if (!date) return null;
  return Math.round(((Date.now() - date.getTime()) / (60 * 60 * 1000)) * 10) / 10;
}

export async function reliabilityRoutes(fastify: FastifyInstance) {
  // GET /reliability/duplicate-clusters?hours=24&minSize=2&limit=20
  fastify.get('/duplicate-clusters', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, unknown>;
    const hours = Math.min(168, toNumber(query.hours, 24));
    const minSize = Math.min(10, toNumber(query.minSize, 2));
    const limit = Math.min(100, toNumber(query.limit, 20));

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const articles = await fastify.prisma.article.findMany({
      where: {
        status: { in: ['FETCHED', 'ENRICHED'] },
        publishedAt: { gte: since },
      },
      select: {
        id: true,
        titleOriginal: true,
        url: true,
        urlNormalized: true,
        publishedAt: true,
        source: { select: { name: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 500,
    });

    const clusters = clusterDuplicateStories(
      articles.map((a) => ({
        id: a.id,
        titleOriginal: a.titleOriginal,
        url: a.url,
        urlNormalized: a.urlNormalized,
        publishedAt: a.publishedAt,
        sourceName: a.source.name,
      })),
      {
        minClusterSize: minSize,
        maxAgeHours: hours,
      }
    ).slice(0, limit);

    return {
      generatedAt: new Date().toISOString(),
      windowHours: hours,
      minClusterSize: minSize,
      totalClusters: clusters.length,
      duplicateArticles: clusters.reduce((sum, c) => sum + c.size, 0),
      clusters,
    };
  });

  // GET /reliability/health
  fastify.get('/health', async () => {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const staleCutoffHours = toNumber(process.env.RELIABILITY_STALE_SOURCE_HOURS, 12);
    const staleCutoff = new Date(now.getTime() - staleCutoffHours * 60 * 60 * 1000);

    const [
      pendingArticles,
      fetchedArticles,
      enrichedArticles,
      failedArticles,
      pendingPosts,
      posted24h,
      failedPosts24h,
      failedJobs24h,
      totalJobs24h,
      enabledSources,
      sourceFreshness,
      latestMorningSummary,
      latestEveningSummary,
      duplicateCandidates,
    ] = await Promise.all([
      fastify.prisma.article.count({ where: { status: 'PENDING' } }),
      fastify.prisma.article.count({ where: { status: 'FETCHED' } }),
      fastify.prisma.article.count({ where: { status: 'ENRICHED' } }),
      fastify.prisma.article.count({ where: { status: 'FAILED' } }),
      fastify.prisma.posting.count({ where: { status: 'PENDING' } }),
      fastify.prisma.posting.count({ where: { status: 'POSTED', createdAt: { gte: last24h } } }),
      fastify.prisma.posting.count({ where: { status: 'FAILED', createdAt: { gte: last24h } } }),
      fastify.prisma.jobAudit.count({ where: { status: 'FAILED', createdAt: { gte: last24h } } }),
      fastify.prisma.jobAudit.count({ where: { createdAt: { gte: last24h } } }),
      fastify.prisma.source.count({ where: { enabled: true } }),
      fastify.prisma.source.findMany({
        where: { enabled: true },
        select: {
          id: true,
          name: true,
          _count: { select: { articles: true } },
          articles: {
            select: { publishedAt: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      fastify.prisma.marketSummary.findFirst({ where: { scheduleType: 'morning' }, orderBy: { createdAt: 'desc' } }),
      fastify.prisma.marketSummary.findFirst({ where: { scheduleType: 'evening' }, orderBy: { createdAt: 'desc' } }),
      fastify.prisma.article.findMany({
        where: { status: { in: ['FETCHED', 'ENRICHED'] }, publishedAt: { gte: last24h } },
        select: {
          id: true,
          titleOriginal: true,
          url: true,
          urlNormalized: true,
          publishedAt: true,
          source: { select: { name: true } },
        },
        orderBy: { publishedAt: 'desc' },
        take: 400,
      }),
    ]);

    const staleSources = sourceFreshness
      .map((source) => {
        const latest = source.articles[0];
        const lastSeen = latest?.publishedAt || latest?.createdAt || null;
        return {
          sourceId: source.id,
          sourceName: source.name,
          articleCount: source._count.articles,
          lastSeenAt: lastSeen,
          ageHours: ageHours(lastSeen),
        };
      })
      .filter((s) => !s.lastSeenAt || s.lastSeenAt < staleCutoff)
      .sort((a, b) => (b.ageHours || 0) - (a.ageHours || 0));

    const duplicateClusters24h = clusterDuplicateStories(
      duplicateCandidates.map((a) => ({
        id: a.id,
        titleOriginal: a.titleOriginal,
        url: a.url,
        urlNormalized: a.urlNormalized,
        publishedAt: a.publishedAt,
        sourceName: a.source.name,
      })),
      { minClusterSize: 2, maxAgeHours: 24 }
    );

    const postAttempts24h = posted24h + failedPosts24h;

    return {
      generatedAt: now.toISOString(),
      pipeline: {
        pendingArticles,
        fetchedArticles,
        enrichedArticles,
        failedArticles,
        pendingPosts,
      },
      delivery24h: {
        posted: posted24h,
        failed: failedPosts24h,
        attempts: postAttempts24h,
        successRate: postAttempts24h > 0 ? Number((posted24h / postAttempts24h).toFixed(3)) : 1,
      },
      jobs24h: {
        total: totalJobs24h,
        failed: failedJobs24h,
        failureRate: totalJobs24h > 0 ? Number((failedJobs24h / totalJobs24h).toFixed(3)) : 0,
      },
      sources: {
        enabled: enabledSources,
        staleThresholdHours: staleCutoffHours,
        staleCount: staleSources.length,
        staleSources,
      },
      summaries: {
        morning: latestMorningSummary
          ? {
              id: latestMorningSummary.id,
              createdAt: latestMorningSummary.createdAt,
              discordPosted: latestMorningSummary.discordPosted,
              ageHours: ageHours(latestMorningSummary.createdAt),
              error: latestMorningSummary.error,
            }
          : null,
        evening: latestEveningSummary
          ? {
              id: latestEveningSummary.id,
              createdAt: latestEveningSummary.createdAt,
              discordPosted: latestEveningSummary.discordPosted,
              ageHours: ageHours(latestEveningSummary.createdAt),
              error: latestEveningSummary.error,
            }
          : null,
      },
      duplicates24h: {
        clusters: duplicateClusters24h.length,
        duplicateArticles: duplicateClusters24h.reduce((sum, c) => sum + c.size, 0),
        topClusters: duplicateClusters24h.slice(0, 5),
      },
      breakingNews: {
        enabled: process.env.ENABLE_BREAKING_NEWS_MODE === 'true',
        allowMediumImpact: process.env.BREAKING_NEWS_ALLOW_MEDIUM_IMPACT !== 'false',
        minImpactScore: Number(process.env.BREAKING_NEWS_MIN_IMPACT_SCORE || '0.75'),
        minKeywordMatches: Number(process.env.BREAKING_NEWS_MIN_KEYWORD_MATCHES || '1'),
      },
    };
  });
}
