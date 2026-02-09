import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ArticleFilterSchema, PostToDiscordRequestSchema, getChannelForTags } from '@crypto-news/shared';
import { Prisma } from '@prisma/client';

export async function articlesRoutes(fastify: FastifyInstance) {
  // GET /articles - List articles with filters
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = ArticleFilterSchema.safeParse(request.query);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { sourceId, tags, sentiment, marketImpact, status, posted, search, startDate, endDate, page, pageSize } =
      validation.data;

    // Build where clause
    const where: Prisma.ArticleWhereInput = {};

    if (sourceId) {
      where.sourceId = sourceId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.publishedAt = {};
      if (startDate) {
        where.publishedAt.gte = startDate;
      }
      if (endDate) {
        where.publishedAt.lte = endDate;
      }
    }

    if (search) {
      where.OR = [
        { titleOriginal: { contains: search, mode: 'insensitive' } },
        { enrichment: { titleTh: { contains: search, mode: 'insensitive' } } },
        { enrichment: { summaryTh: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (tags && tags.length > 0) {
      where.enrichment = {
        ...((where.enrichment as Prisma.EnrichmentWhereInput) || {}),
        tags: {
          array_contains: tags,
        },
      };
    }

    if (sentiment) {
      where.enrichment = {
        ...((where.enrichment as Prisma.EnrichmentWhereInput) || {}),
        sentiment: sentiment.toUpperCase() as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
      };
    }

    if (marketImpact) {
      where.enrichment = {
        ...((where.enrichment as Prisma.EnrichmentWhereInput) || {}),
        marketImpact: marketImpact.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
      };
    }

    if (posted !== undefined) {
      if (posted) {
        where.postings = { some: { status: 'POSTED' } };
      } else {
        where.postings = { none: { status: 'POSTED' } };
      }
    }

    // Count total
    const total = await fastify.prisma.article.count({ where });

    // Fetch articles
    const articles = await fastify.prisma.article.findMany({
      where,
      include: {
        source: { select: { id: true, name: true } },
        enrichment: true,
        postings: {
          select: {
            id: true,
            discordChannelId: true,
            postedAt: true,
            status: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: articles.map((a) => ({
        id: a.id,
        sourceId: a.sourceId,
        sourceName: a.source.name,
        url: a.url,
        titleOriginal: a.titleOriginal,
        publishedAt: a.publishedAt,
        fetchedAt: a.fetchedAt,
        status: a.status,
        enrichment: a.enrichment
          ? {
              id: a.enrichment.id,
              titleTh: a.enrichment.titleTh,
              summaryTh: a.enrichment.summaryTh,
              tags: a.enrichment.tags,
              sentiment: a.enrichment.sentiment.toLowerCase(),
              marketImpact: a.enrichment.marketImpact.toLowerCase(),
              contentDraftTh: a.enrichment.contentDraftTh,
              cautions: a.enrichment.cautions,
              mustQuote: a.enrichment.mustQuote,
            }
          : null,
        postings: a.postings,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  });

  // GET /articles/:id - Get single article
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const article = await fastify.prisma.article.findUnique({
      where: { id },
      include: {
        source: { select: { id: true, name: true } },
        enrichment: true,
        postings: true,
      },
    });

    if (!article) {
      return reply.status(404).send({ error: 'Article not found' });
    }

    return {
      id: article.id,
      sourceId: article.sourceId,
      sourceName: article.source.name,
      url: article.url,
      urlNormalized: article.urlNormalized,
      titleOriginal: article.titleOriginal,
      publishedAt: article.publishedAt,
      fetchedAt: article.fetchedAt,
      rawHtml: article.rawHtml,
      extractedText: article.extractedText,
      language: article.language,
      status: article.status,
      enrichment: article.enrichment
        ? {
            id: article.enrichment.id,
            titleTh: article.enrichment.titleTh,
            summaryTh: article.enrichment.summaryTh,
            tags: article.enrichment.tags,
            sentiment: article.enrichment.sentiment.toLowerCase(),
            marketImpact: article.enrichment.marketImpact.toLowerCase(),
            contentDraftTh: article.enrichment.contentDraftTh,
            cautions: article.enrichment.cautions,
            mustQuote: article.enrichment.mustQuote,
            llmModel: article.enrichment.llmModel,
            llmProvider: article.enrichment.llmProvider,
            createdAt: article.enrichment.createdAt,
          }
        : null,
      postings: article.postings.map((p) => ({
        id: p.id,
        discordChannelId: p.discordChannelId,
        discordMessageId: p.discordMessageId,
        postedAt: p.postedAt,
        status: p.status,
        error: p.error,
      })),
    };
  });

  // POST /articles/:id/post - Post article to Discord
  fastify.post(
    '/:id/post',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const validation = PostToDiscordRequestSchema.safeParse(request.body || {});

      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const article = await fastify.prisma.article.findUnique({
        where: { id },
        include: { enrichment: true },
      });

      if (!article) {
        return reply.status(404).send({ error: 'Article not found' });
      }

      if (!article.enrichment) {
        return reply.status(400).send({ error: 'Article has not been enriched yet' });
      }

      // Determine channel
      const tags = (article.enrichment.tags as string[]) || [];
      const channelId = validation.data.channelId || getChannelForTags(tags, fastify.config.discord.channelRouting);

      if (!channelId) {
        return reply.status(400).send({ error: 'No channel ID provided and no default channel configured' });
      }

      // Create posting record (actual posting will be done by the bot/worker)
      const posting = await fastify.prisma.posting.create({
        data: {
          articleId: id,
          discordChannelId: channelId,
          status: 'PENDING',
        },
      });

      return {
        id: posting.id,
        articleId: id,
        discordChannelId: channelId,
        status: posting.status,
        message: 'Post queued. The bot will send it shortly.',
      };
    }
  );

  // GET /articles/stats - Get article statistics
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.setDate(now.getDate() - 7));

    const [totalArticles, enrichedArticles, postedToday, postedWeek, bySource, byTag, bySentiment] = await Promise.all([
      fastify.prisma.article.count(),
      fastify.prisma.article.count({ where: { status: 'ENRICHED' } }),
      fastify.prisma.posting.count({
        where: { postedAt: { gte: todayStart }, status: 'POSTED' },
      }),
      fastify.prisma.posting.count({
        where: { postedAt: { gte: weekStart }, status: 'POSTED' },
      }),
      fastify.prisma.article.groupBy({
        by: ['sourceId'],
        _count: { id: true },
      }),
      fastify.prisma.enrichment.findMany({
        select: { tags: true },
      }),
      fastify.prisma.enrichment.groupBy({
        by: ['sentiment'],
        _count: { id: true },
      }),
    ]);

    // Count tags
    const tagCounts: Record<string, number> = {};
    byTag.forEach((e) => {
      const tags = e.tags as string[];
      tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // Get source names
    const sources = await fastify.prisma.source.findMany({
      select: { id: true, name: true },
    });
    const sourceMap = new Map(sources.map((s) => [s.id, s.name]));

    return {
      total: totalArticles,
      enriched: enrichedArticles,
      postedToday,
      postedWeek,
      bySource: bySource.map((s) => ({
        sourceId: s.sourceId,
        sourceName: sourceMap.get(s.sourceId) || 'Unknown',
        count: s._count.id,
      })),
      byTag: Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count),
      bySentiment: bySentiment.map((s) => ({
        sentiment: s.sentiment.toLowerCase(),
        count: s._count.id,
      })),
    };
  });
}
