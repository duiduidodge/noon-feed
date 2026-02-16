import { PrismaClient } from '@prisma/client';
import { buildConfig, createLogger } from '@crypto-news/shared';
import { RSSFetcher } from '../services/rss-fetcher.js';
import { APINewsFetcher } from '../services/api-news-fetcher.js';
import { ArticleFetcher } from '../services/article-fetcher.js';
import { processFetchRSSJob } from '../jobs/fetch-rss.js';
import { processFetchAPINewsJob } from '../jobs/fetch-api-news.js';
import { processFetchArticleJob } from '../jobs/fetch-article.js';
import { EnrichmentMapper } from '../services/enrichment-mapper.js';

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

async function enrichAPIArticles() {
  // Apply free enrichment mapping to all fetched articles (RSS + API)
  const articles = await prisma.article.findMany({
    where: {
      status: 'FETCHED',
      enrichment: null,
    },
    take: 50,
    orderBy: { publishedAt: 'desc' },
  });

  logger.info({ count: articles.length }, 'Applying free enrichment to API articles');

  let enriched = 0;
  for (const article of articles) {
    try {
      // Basic heuristic enrichment from title
      const title = article.titleOriginal.toLowerCase();
      let category = 'general';
      let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';

      if (title.includes('etf') || title.includes('sec')) category = 'etf';
      else if (title.includes('institution') || title.includes('bank')) category = 'institutional';
      else if (title.includes('bitcoin') || title.includes('btc')) category = 'bitcoin';
      else if (title.includes('defi')) category = 'defi';
      else if (title.includes('nft')) category = 'nft';

      if (title.includes('bull') || title.includes('surge') || title.includes('rally')) sentiment = 'positive';
      else if (title.includes('bear') || title.includes('crash') || title.includes('dump')) sentiment = 'negative';

      const mapped = EnrichmentMapper.mapEnrichment({
        externalCategory: category,
        externalSentiment: sentiment,
      });

      await prisma.enrichment.create({
        data: {
          article: {
            connect: { id: article.id },
          },
          sentiment: mapped.sentiment,
          marketImpact: mapped.marketImpact,
          tags: mapped.tags,
          titleTh: null,
          summaryTh: null,
          takeawaysTh: [],
          hooksTh: [],
          threadTh: [],
          contentDraftTh: null,
          cautions: [],
          mustQuote: [],
          llmProvider: 'external',
          llmModel: 'cryptocurrency.cv',
          finnhubSentiment: null,
          fmpSentiment: null,
          sentimentConfidence: null,
          santimentMetrics: null,
          metricsFetchedAt: null,
        },
      });

      await prisma.article.update({
        where: { id: article.id },
        data: { status: 'ENRICHED' },
      });

      enriched++;
    } catch (error) {
      logger.error({ error: (error as Error).message, articleId: article.id }, 'Failed to enrich');
    }
  }

  logger.info({ enriched }, 'Finished enriching API articles');
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
  await enrichAPIArticles(); // Apply free enrichment to API articles
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
