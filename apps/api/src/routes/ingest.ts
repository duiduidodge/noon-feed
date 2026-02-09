import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ManualIngestRequestSchema, normalizeUrl, createArticleHash, createLogger } from '@crypto-news/shared';

const logger = createLogger('api:ingest');

export async function ingestRoutes(fastify: FastifyInstance) {
  // POST /ingest/url - Manual URL ingest
  fastify.post('/url', async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = ManualIngestRequestSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { url } = validation.data;
    const normalizedUrl = normalizeUrl(url);

    // Check if already exists
    const existing = await fastify.prisma.article.findUnique({
      where: { urlNormalized: normalizedUrl },
    });

    if (existing) {
      return reply.status(409).send({
        error: 'Article already exists',
        articleId: existing.id,
      });
    }

    // Find or create manual source
    let manualSource = await fastify.prisma.source.findFirst({
      where: { type: 'MANUAL' },
    });

    if (!manualSource) {
      manualSource = await fastify.prisma.source.create({
        data: {
          name: 'Manual Ingest',
          type: 'MANUAL',
          url: 'manual://ingest',
          enabled: true,
        },
      });
    }

    // Create article record with PENDING status
    const hash = createArticleHash('Manual Ingest', url, new Date());

    const article = await fastify.prisma.article.create({
      data: {
        sourceId: manualSource.id,
        url,
        urlNormalized: normalizedUrl,
        titleOriginal: 'Pending fetch...',
        hash,
        status: 'PENDING',
      },
    });

    // Log job audit
    await fastify.prisma.jobAudit.create({
      data: {
        jobType: 'MANUAL_INGEST',
        articleId: article.id,
        status: 'STARTED',
        metadata: { url },
      },
    });

    logger.info({ articleId: article.id, url }, 'Manual ingest queued');

    return reply.status(202).send({
      articleId: article.id,
      status: 'queued',
      message: 'Article will be fetched and processed shortly',
    });
  });

  // POST /ingest/run - Trigger ingestion run
  fastify.post('/run', async (request: FastifyRequest, reply: FastifyReply) => {
    const sources = await fastify.prisma.source.findMany({
      where: { enabled: true, type: 'RSS' },
    });

    // Log job audit
    await fastify.prisma.jobAudit.create({
      data: {
        jobType: 'FETCH_RSS',
        status: 'STARTED',
        metadata: { sourceCount: sources.length },
      },
    });

    logger.info({ sourceCount: sources.length }, 'Ingestion run triggered');

    return {
      status: 'started',
      message: `Ingestion started for ${sources.length} sources`,
      sources: sources.map((s) => ({ id: s.id, name: s.name })),
    };
  });

  // GET /ingest/status - Get ingestion status
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const recentJobs = await fastify.prisma.jobAudit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const pendingArticles = await fastify.prisma.article.count({
      where: { status: 'PENDING' },
    });

    const failedArticles = await fastify.prisma.article.count({
      where: { status: 'FAILED' },
    });

    return {
      pendingArticles,
      failedArticles,
      recentJobs: recentJobs.map((j) => ({
        id: j.id,
        jobType: j.jobType,
        articleId: j.articleId,
        status: j.status,
        error: j.error,
        createdAt: j.createdAt,
      })),
    };
  });
}
