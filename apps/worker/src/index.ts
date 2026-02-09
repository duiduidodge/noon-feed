import { PrismaClient } from '@prisma/client';
import { Queue, Worker, Job } from 'bullmq';
import { createLogger, buildConfig, sleep } from '@crypto-news/shared';
import { createLLMProvider } from './services/llm-provider.js';
import { ArticleFetcher } from './services/article-fetcher.js';
import { RSSFetcher } from './services/rss-fetcher.js';
import { APINewsFetcher } from './services/api-news-fetcher.js';
import { processFetchRSSJob, type FetchRSSJobData } from './jobs/fetch-rss.js';
import { processFetchAPINewsJob, type FetchAPINewsJobData } from './jobs/fetch-api-news.js';
import { processFetchArticleJob, type FetchArticleJobData } from './jobs/fetch-article.js';
import { processEnrichArticleJob, type EnrichArticleJobData } from './jobs/enrich-article.js';
import { processPostDiscordWebhookJob, type PostDiscordWebhookJobData } from './jobs/post-discord-webhook.js';
import { processGenerateSummaryJob, type GenerateSummaryJobData } from './jobs/generate-summary.js';

const logger = createLogger('worker');
const config = buildConfig();
const prisma = new PrismaClient();

// Initialize services
const rssFetcher = new RSSFetcher({
  userAgent: config.fetcher.userAgent,
  timeoutMs: config.fetcher.timeoutMs,
});

const articleFetcher = new ArticleFetcher({
  userAgent: config.fetcher.userAgent,
  timeoutMs: config.fetcher.timeoutMs,
});

const apiNewsFetcher = new APINewsFetcher({
  userAgent: config.fetcher.userAgent,
  timeoutMs: config.fetcher.timeoutMs,
});

// Get the appropriate API key based on provider
function getLlmApiKey(): string {
  if (config.llm.provider === 'openai') {
    if (!config.llm.openaiApiKey) {
      throw new Error('Missing OPENAI_API_KEY for provider=openai');
    }
    return config.llm.openaiApiKey;
  }

  if (config.llm.provider === 'anthropic') {
    if (!config.llm.anthropicApiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY for provider=anthropic');
    }
    return config.llm.anthropicApiKey;
  }

  if (config.llm.provider === 'openrouter') {
    if (!config.llm.openrouterApiKey) {
      throw new Error('Missing OPENROUTER_API_KEY for provider=openrouter');
    }
    return config.llm.openrouterApiKey;
  }

  throw new Error(`Unknown LLM provider: ${config.llm.provider}`);
}

const llmApiKey = getLlmApiKey();

const llmProvider = createLLMProvider(
  config.llm.provider,
  llmApiKey,
  config.llm.model
);

// Redis connection options
const redisConnection = {
  host: new URL(config.redis.url).hostname,
  port: parseInt(new URL(config.redis.url).port || '6379'),
};

// Queues
const rssQueue = new Queue('rss-fetch', { connection: redisConnection });
const apiNewsQueue = new Queue('api-news-fetch', { connection: redisConnection });
const articleQueue = new Queue('article-fetch', { connection: redisConnection });
const enrichQueue = new Queue('enrich', { connection: redisConnection });
const discordQueue = new Queue('discord-post', { connection: redisConnection });
const summaryQueue = new Queue('summary', { connection: redisConnection });

// Workers
const rssWorker = new Worker<FetchRSSJobData>(
  'rss-fetch',
  async (job: Job<FetchRSSJobData>) => {
    return processFetchRSSJob(job.data, prisma, rssFetcher);
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

const apiNewsWorker = new Worker<FetchAPINewsJobData>(
  'api-news-fetch',
  async (job: Job<FetchAPINewsJobData>) => {
    return processFetchAPINewsJob(job.data, prisma, apiNewsFetcher);
  },
  {
    connection: redisConnection,
    concurrency: 1, // Respect rate limit: 1 req/sec
  }
);

const articleWorker = new Worker<FetchArticleJobData>(
  'article-fetch',
  async (job: Job<FetchArticleJobData>) => {
    return processFetchArticleJob(job.data, prisma, articleFetcher);
  },
  {
    connection: redisConnection,
    concurrency: config.worker.concurrency,
  }
);

const enrichWorker = new Worker<EnrichArticleJobData>(
  'enrich',
  async (job: Job<EnrichArticleJobData>) => {
    return processEnrichArticleJob(job.data, prisma, llmProvider, config.llm.model);
  },
  {
    connection: redisConnection,
    concurrency: 2, // Lower concurrency for LLM calls
  }
);

const discordWorker = new Worker<PostDiscordWebhookJobData>(
  'discord-post',
  async (job: Job<PostDiscordWebhookJobData>) => {
    return processPostDiscordWebhookJob(job.data, prisma);
  },
  {
    connection: redisConnection,
    concurrency: 1, // Sequential Discord posts to respect rate limits
  }
);

const summaryWorker = new Worker<GenerateSummaryJobData>(
  'summary',
  async (job: Job<GenerateSummaryJobData>) => {
    return processGenerateSummaryJob(job.data, prisma, llmProvider);
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

// Error handlers
[rssWorker, apiNewsWorker, articleWorker, enrichWorker, discordWorker, summaryWorker].forEach((worker) => {
  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, queue: worker.name }, 'Job completed');
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, queue: worker.name, error: error.message }, 'Job failed');
  });
});

// Scheduler: Add RSS fetch jobs periodically
async function scheduleRSSFetches() {
  const sources = await prisma.source.findMany({
    where: { enabled: true, type: 'RSS' },
  });

  for (const source of sources) {
    await rssQueue.add(
      `fetch-${source.id}`,
      {
        sourceId: source.id,
        sourceName: source.name,
        feedUrl: source.url,
      },
      {
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
  }

  logger.info({ sourceCount: sources.length }, 'Scheduled RSS fetch jobs');
}

// Scheduler: Add API news fetch jobs periodically
async function scheduleAPINewsFetches() {
  const sources = await prisma.source.findMany({
    where: { enabled: true, type: 'API' },
  });

  for (const source of sources) {
    await apiNewsQueue.add(
      `fetch-api-${source.id}`,
      {
        sourceId: source.id,
        sourceName: source.name,
        apiBaseUrl: source.url,
      },
      {
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
  }

  logger.info({ sourceCount: sources.length }, 'Scheduled API news fetch jobs');
}

// Process pending articles
async function processPendingArticles() {
  const pendingArticles = await prisma.article.findMany({
    where: { status: 'PENDING' },
    take: 10,
    orderBy: { createdAt: 'asc' },
  });

  for (const article of pendingArticles) {
    await articleQueue.add(
      `fetch-article-${article.id}`,
      { articleId: article.id },
      { jobId: `fetch-article-${article.id}`, removeOnComplete: 100, removeOnFail: 50 }
    );
  }

  if (pendingArticles.length > 0) {
    logger.info({ count: pendingArticles.length }, 'Queued pending articles for fetch');
  }
}

// Process fetched articles for enrichment (only if enrichment is enabled)
async function processFetchedArticles() {
  if (config.worker.skipEnrichment) {
    return; // Skip enrichment — we use bi-daily summaries instead
  }

  const fetchedArticles = await prisma.article.findMany({
    where: { status: 'FETCHED' },
    take: 5,
    orderBy: { createdAt: 'asc' },
  });

  for (const article of fetchedArticles) {
    await enrichQueue.add(
      `enrich-${article.id}`,
      { articleId: article.id },
      { jobId: `enrich-${article.id}`, removeOnComplete: 100, removeOnFail: 50 }
    );
  }

  if (fetchedArticles.length > 0) {
    logger.info({ count: fetchedArticles.length }, 'Queued fetched articles for enrichment');
  }
}

// Auto-create postings for enriched articles (only if auto-posting is enabled)
async function processEnrichedArticles() {
  if (!config.worker.autoPostToDiscord) {
    return; // Skip — we use bi-daily summaries now
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const enrichedArticles = await prisma.article.findMany({
    where: {
      status: 'ENRICHED',
      postings: { none: {} },
    },
    take: 10,
    orderBy: { publishedAt: 'desc' },
  });

  if (enrichedArticles.length === 0) return;

  for (const article of enrichedArticles) {
    await prisma.posting.create({
      data: {
        articleId: article.id,
        discordChannelId: 'webhook',
        status: 'PENDING',
      },
    });
  }

  logger.info({ count: enrichedArticles.length }, 'Auto-created postings for enriched articles');
}

// Process pending Discord posts (only if auto-posting is enabled)
async function processPendingPosts() {
  if (!config.worker.autoPostToDiscord) {
    return; // Skip — we use bi-daily summaries now
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const pendingPostings = await prisma.posting.findMany({
    where: { status: 'PENDING' },
    take: 5,
    orderBy: { createdAt: 'asc' },
  });

  for (const posting of pendingPostings) {
    await discordQueue.add(
      `post-${posting.id}`,
      { postingId: posting.id, webhookUrl },
      { jobId: `post-${posting.id}`, removeOnComplete: 100, removeOnFail: 50 }
    );
  }

  if (pendingPostings.length > 0) {
    logger.info({ count: pendingPostings.length }, 'Queued pending Discord posts');
  }
}

// ============================================================
// Bi-daily summary scheduler
// Runs at 7:00 AM and 7:00 PM Bangkok time (00:00 and 12:00 UTC)
// ============================================================
const SUMMARY_HOURS_BANGKOK = [7, 19];
let lastSummaryKey = '';

async function checkSummarySchedule() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const now = new Date();
  const bangkokHour = (now.getUTCHours() + 7) % 24;
  const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const scheduleType = bangkokHour >= 7 && bangkokHour < 19 ? 'morning' : 'evening';
  const summaryKey = `${dateKey}-${scheduleType}`;

  // Only fire once per schedule window
  if (!SUMMARY_HOURS_BANGKOK.includes(bangkokHour) || lastSummaryKey === summaryKey) {
    return;
  }

  // Double-check against database to prevent duplicates after restart
  const recentSummary = await prisma.marketSummary.findFirst({
    where: {
      scheduleType,
      createdAt: { gt: new Date(Date.now() - 10 * 60 * 60 * 1000) }, // Within last 10 hours
    },
  });

  if (recentSummary) {
    lastSummaryKey = summaryKey;
    logger.info({ scheduleType }, 'Summary already generated for this period, skipping');
    return;
  }

  lastSummaryKey = summaryKey;

  logger.info({ scheduleType, bangkokHour }, 'Scheduling bi-daily summary generation');

  await summaryQueue.add(
    `summary-${summaryKey}`,
    { scheduleType, webhookUrl },
    { jobId: `summary-${summaryKey}`, removeOnComplete: 50, removeOnFail: 20 }
  );
}

// Main loop
async function main() {
  logger.info({
    skipEnrichment: config.worker.skipEnrichment,
    autoPostToDiscord: config.worker.autoPostToDiscord,
  }, 'Worker starting...');

  // Initial backfill - RSS sources
  logger.info('Running initial RSS backfill...');
  const rssSources = await prisma.source.findMany({
    where: { enabled: true, type: 'RSS' },
  });

  for (const source of rssSources) {
    await rssQueue.add(
      `backfill-${source.id}`,
      {
        sourceId: source.id,
        sourceName: source.name,
        feedUrl: source.url,
        backfillHours: 24, // Last 24 hours on startup
      },
      { removeOnComplete: 100, removeOnFail: 50 }
    );
  }

  // Initial backfill - API sources
  logger.info('Running initial API backfill...');
  const apiSources = await prisma.source.findMany({
    where: { enabled: true, type: 'API' },
  });

  for (const source of apiSources) {
    await apiNewsQueue.add(
      `backfill-api-${source.id}`,
      {
        sourceId: source.id,
        sourceName: source.name,
        apiBaseUrl: source.url,
        backfillHours: 24, // Last 24 hours on startup
      },
      { removeOnComplete: 100, removeOnFail: 50 }
    );
  }

  // Scheduler loop
  const intervalMs = config.worker.fetchIntervalMinutes * 60 * 1000;
  let lastRSSFetch = Date.now();
  let lastAPIFetch = Date.now();

  logger.info({ intervalMinutes: config.worker.fetchIntervalMinutes }, 'Worker started, entering main loop');

  while (true) {
    try {
      // Schedule RSS fetches periodically
      if (Date.now() - lastRSSFetch >= intervalMs) {
        await scheduleRSSFetches();
        lastRSSFetch = Date.now();
      }

      // Schedule API news fetches periodically
      if (Date.now() - lastAPIFetch >= intervalMs) {
        await scheduleAPINewsFetches();
        lastAPIFetch = Date.now();
      }

      // Process pending work
      await processPendingArticles();
      await processFetchedArticles();
      await processEnrichedArticles();
      await processPendingPosts();

      // Check if it's time for a bi-daily summary
      await checkSummarySchedule();

      // Wait before next iteration
      await sleep(10000); // Check every 10 seconds
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Error in main loop');
      await sleep(30000); // Wait longer on error
    }
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down worker...');

  await rssWorker.close();
  await apiNewsWorker.close();
  await articleWorker.close();
  await enrichWorker.close();
  await discordWorker.close();
  await summaryWorker.close();

  await rssQueue.close();
  await apiNewsQueue.close();
  await articleQueue.close();
  await enrichQueue.close();
  await discordQueue.close();
  await summaryQueue.close();

  await prisma.$disconnect();

  logger.info('Worker shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((error) => {
  logger.error({ error: error.message }, 'Worker fatal error');
  process.exit(1);
});
