import { PrismaClient } from '@prisma/client';
import { buildConfig, createLogger } from '@crypto-news/shared';
import { RSSFetcher } from '../services/rss-fetcher.js';
import { APINewsFetcher } from '../services/api-news-fetcher.js';
import { ArticleFetcher } from '../services/article-fetcher.js';
import { processFetchRSSJob } from '../jobs/fetch-rss.js';
import { processFetchAPINewsJob } from '../jobs/fetch-api-news.js';
import { processFetchArticleJob } from '../jobs/fetch-article.js';

const logger = createLogger('worker:cli:ingest-once');
const prisma = new PrismaClient();

const backfillHours = Number(process.env.INGEST_BACKFILL_HOURS || '6');
const pendingBatchSize = Number(process.env.INGEST_PENDING_BATCH_SIZE || '25');
const pendingMaxBatches = Number(process.env.INGEST_PENDING_MAX_BATCHES || '10');

async function runSourceFetches(config: ReturnType<typeof buildConfig>) {
  const rssFetcher = new RSSFetcher({
    userAgent: config.fetcher.userAgent,
    timeoutMs: config.fetcher.timeoutMs,
  });

  const apiNewsFetcher = new APINewsFetcher({
    userAgent: config.fetcher.userAgent,
    timeoutMs: config.fetcher.timeoutMs,
  });

  const rssSources = await prisma.source.findMany({ where: { enabled: true, type: 'RSS' } });
  const apiSources = await prisma.source.findMany({ where: { enabled: true, type: 'API' } });

  logger.info({ rssSources: rssSources.length, apiSources: apiSources.length, backfillHours }, 'Running one-shot source fetch');

  for (const source of rssSources) {
    try {
      await processFetchRSSJob(
        {
          sourceId: source.id,
          sourceName: source.name,
          feedUrl: source.url,
          backfillHours,
        },
        prisma,
        rssFetcher
      );
    } catch (error) {
      logger.error({ sourceId: source.id, error: (error as Error).message }, 'RSS fetch failed in one-shot run');
    }
  }

  for (const source of apiSources) {
    try {
      await processFetchAPINewsJob(
        {
          sourceId: source.id,
          sourceName: source.name,
          apiBaseUrl: source.url,
          backfillHours,
        },
        prisma,
        apiNewsFetcher
      );
    } catch (error) {
      logger.error({ sourceId: source.id, error: (error as Error).message }, 'API fetch failed in one-shot run');
    }
  }
}

async function processPendingArticles(config: ReturnType<typeof buildConfig>) {
  const articleFetcher = new ArticleFetcher({
    userAgent: config.fetcher.userAgent,
    timeoutMs: config.fetcher.timeoutMs,
  });

  let totalProcessed = 0;

  for (let i = 0; i < pendingMaxBatches; i++) {
    const pendingArticles = await prisma.article.findMany({
      where: { status: 'PENDING' },
      take: pendingBatchSize,
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (pendingArticles.length === 0) break;

    for (const article of pendingArticles) {
      try {
        await processFetchArticleJob({ articleId: article.id }, prisma, articleFetcher);
        totalProcessed += 1;
      } catch (error) {
        logger.error({ articleId: article.id, error: (error as Error).message }, 'Article fetch failed in one-shot run');
      }
    }
  }

  logger.info({ totalProcessed }, 'Finished one-shot pending article processing');
}

async function printStatus() {
  const counts = {
    pending: await prisma.article.count({ where: { status: 'PENDING' } }),
    fetched: await prisma.article.count({ where: { status: 'FETCHED' } }),
    enriched: await prisma.article.count({ where: { status: 'ENRICHED' } }),
    failed: await prisma.article.count({ where: { status: 'FAILED' } }),
  };

  const latest = await prisma.article.findFirst({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      titleOriginal: true,
      status: true,
      createdAt: true,
      source: { select: { name: true } },
    },
  });

  logger.info({ counts, latest }, 'One-shot ingest status');
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL. Add it to GitHub Actions secrets.');
  }

  const config = buildConfig();

  logger.info('Starting one-shot ingest run');

  await runSourceFetches(config);
  await processPendingArticles(config);
  await printStatus();

  logger.info('One-shot ingest run complete');
}

main()
  .catch((error) => {
    logger.error(
      { error: (error as Error).message, stack: (error as Error).stack },
      'One-shot ingest run failed'
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
