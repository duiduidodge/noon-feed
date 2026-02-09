import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ArticleFilterSchema } from '@crypto-news/shared';
import { Prisma } from '@prisma/client';

export async function exportRoutes(fastify: FastifyInstance) {
  // GET /export.csv - Export articles as CSV
  fastify.get('.csv', async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = ArticleFilterSchema.safeParse(request.query);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { sourceId, tags, sentiment, marketImpact, status, posted, search, startDate, endDate } = validation.data;

    // Build where clause (same as articles route)
    const where: Prisma.ArticleWhereInput = {
      status: 'ENRICHED', // Only export enriched articles
    };

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

    // Fetch articles
    const articles = await fastify.prisma.article.findMany({
      where,
      include: {
        source: { select: { name: true } },
        enrichment: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 1000, // Limit export to 1000 rows
    });

    // Generate CSV
    const headers = [
      'title_th',
      'summary_th',
      'content_draft_th',
      'url',
      'source',
      'publishedAt',
      'tags',
      'sentiment',
      'marketImpact',
    ];

    const escapeCSV = (value: string | null | undefined): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = articles
      .filter((a) => a.enrichment)
      .map((a) => {
        const e = a.enrichment!;
        return [
          escapeCSV(e.titleTh),
          escapeCSV(e.summaryTh),
          escapeCSV(e.contentDraftTh || ''),
          escapeCSV(a.url),
          escapeCSV(a.source.name),
          escapeCSV(a.publishedAt?.toISOString() || ''),
          escapeCSV((e.tags as string[]).join(', ')),
          escapeCSV(e.sentiment.toLowerCase()),
          escapeCSV(e.marketImpact.toLowerCase()),
        ].join(',');
      });

    const csv = [headers.join(','), ...rows].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\ufeff';
    const csvWithBom = bom + csv;

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="crypto-news-export-${new Date().toISOString().split('T')[0]}.csv"`)
      .send(csvWithBom);
  });

  // GET /export.json - Export articles as JSON
  fastify.get('.json', async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = ArticleFilterSchema.safeParse(request.query);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { sourceId, tags, sentiment, marketImpact, status, posted, search, startDate, endDate } = validation.data;

    const where: Prisma.ArticleWhereInput = {
      status: 'ENRICHED',
    };

    if (sourceId) where.sourceId = sourceId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.publishedAt = {};
      if (startDate) where.publishedAt.gte = startDate;
      if (endDate) where.publishedAt.lte = endDate;
    }

    if (tags && tags.length > 0) {
      where.enrichment = { tags: { array_contains: tags } };
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

    const articles = await fastify.prisma.article.findMany({
      where,
      include: {
        source: { select: { name: true } },
        enrichment: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 1000,
    });

    const exportData = articles
      .filter((a) => a.enrichment)
      .map((a) => ({
        title_th: a.enrichment!.titleTh,
        summary_th: a.enrichment!.summaryTh,
        content_draft_th: a.enrichment!.contentDraftTh || '',
        url: a.url,
        source: a.source.name,
        publishedAt: a.publishedAt?.toISOString(),
        tags: a.enrichment!.tags,
        sentiment: a.enrichment!.sentiment.toLowerCase(),
        marketImpact: a.enrichment!.marketImpact.toLowerCase(),
        cautions: a.enrichment!.cautions,
      }));

    reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="crypto-news-export-${new Date().toISOString().split('T')[0]}.json"`)
      .send(JSON.stringify(exportData, null, 2));
  });
}
