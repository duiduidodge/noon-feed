import { PrismaClient } from '@prisma/client';
import { Queue, Worker, Job } from 'bullmq';
import { createLogger, buildConfig, sleep } from '@crypto-news/shared';
import { createLLMProvider } from './services/llm-provider.js';
import { ArticleFetcher } from './services/article-fetcher.js';
import { RSSFetcher } from './services/rss-fetcher.js';
import { APINewsFetcher } from './services/api-news-fetcher.js';
import { ImpactFilter } from './services/impact-filter.js';
import { DiscordWebhookService } from './services/discord-webhook.js';
import { EnrichmentMapper } from './services/enrichment-mapper.js';
import { processFetchRSSJob, type FetchRSSJobData } from './jobs/fetch-rss.js';
import { processFetchAPINewsJob, type FetchAPINewsJobData } from './jobs/fetch-api-news.js';
import { processFetchArticleJob, type FetchArticleJobData } from './jobs/fetch-article.js';
import { processEnrichArticleJob, type EnrichArticleJobData } from './jobs/enrich-article.js';
import { processPostDiscordWebhookJob, type PostDiscordWebhookJobData } from './jobs/post-discord-webhook.js';
import { processGenerateSummaryJob, type GenerateSummaryJobData } from './jobs/generate-summary.js';
import type { LLMProviderInterface } from '@crypto-news/shared';

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

function createFallbackLlmProvider(reason: string): LLMProviderInterface {
  return {
    name: config.llm.provider,
    async complete() {
      throw new Error(`LLM unavailable: ${reason}`);
    },
  };
}

let llmProvider: LLMProviderInterface;
try {
  const llmApiKey = getLlmApiKey();
  llmProvider = createLLMProvider(
    config.llm.provider,
    llmApiKey,
    config.llm.model
  );
} catch (error) {
  const reason = (error as Error).message;
  logger.error({ reason }, 'LLM provider init failed; worker will continue with fallback summaries');
  llmProvider = createFallbackLlmProvider(reason);
}

// Initialize pre-filter LLM provider (use cheap model for cost savings)
let impactFilter: ImpactFilter | undefined;
if (process.env.ENABLE_HIGH_IMPACT_POSTING === 'true' && process.env.OPENAI_API_KEY) {
  try {
    const preFilterLlmProvider = createLLMProvider(
      'openai',
      process.env.OPENAI_API_KEY,
      process.env.PRE_FILTER_LLM_MODEL || 'gpt-4o-mini'
    );
    impactFilter = new ImpactFilter(preFilterLlmProvider, 0.7);
    logger.info('Impact filter initialized with gpt-4o-mini');
  } catch (error) {
    logger.warn({ error: (error as Error).message }, 'Failed to initialize impact filter');
  }
}

// Redis connection options (supports local redis:// and managed rediss:// URLs)
function buildRedisConnection(url: string) {
  const parsed = new URL(url);
  const useTls = parsed.protocol === 'rediss:';

  const connection = {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: useTls ? {} : undefined,
  };

  return connection;
}

const redisConnection = buildRedisConnection(config.redis.url);

// Queues
const rssQueue = new Queue('rss-fetch', { connection: redisConnection });
const apiNewsQueue = new Queue('api-news-fetch', { connection: redisConnection });
const articleQueue = new Queue('article-fetch', { connection: redisConnection });
const enrichQueue = new Queue('enrich', { connection: redisConnection });
const discordQueue = new Queue('discord-post', { connection: redisConnection });
const summaryQueue = new Queue('summary', { connection: redisConnection });

function isQueueUnavailableError(error: unknown): boolean {
  const message = (error as Error)?.message?.toLowerCase?.() || '';
  return (
    message.includes('econnrefused') ||
    message.includes('connect') ||
    message.includes('redis') ||
    message.includes('closed') ||
    message.includes('connection')
  );
}

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
    return processFetchArticleJob(job.data, prisma, articleFetcher, impactFilter);
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
    const payload = {
      sourceId: source.id,
      sourceName: source.name,
      feedUrl: source.url,
    };
    try {
      await rssQueue.add(
        `fetch-${source.id}`,
        payload,
        {
          removeOnComplete: 100,
          removeOnFail: 50,
        }
      );
    } catch (error) {
      if (isQueueUnavailableError(error)) {
        logger.warn({ sourceId: source.id }, 'RSS queue unavailable; running fetch inline');
        await processFetchRSSJob(payload, prisma, rssFetcher);
      } else {
        throw error;
      }
    }
  }

  logger.info({ sourceCount: sources.length }, 'Scheduled RSS fetch jobs');
}

// Scheduler: Add API news fetch jobs periodically
async function scheduleAPINewsFetches() {
  const sources = await prisma.source.findMany({
    where: { enabled: true, type: 'API' },
  });

  for (const source of sources) {
    const payload = {
      sourceId: source.id,
      sourceName: source.name,
      apiBaseUrl: source.url,
    };
    try {
      await apiNewsQueue.add(
        `fetch-api-${source.id}`,
        payload,
        {
          removeOnComplete: 100,
          removeOnFail: 50,
        }
      );
    } catch (error) {
      if (isQueueUnavailableError(error)) {
        logger.warn({ sourceId: source.id }, 'API queue unavailable; running fetch inline');
        await processFetchAPINewsJob(payload, prisma, apiNewsFetcher);
      } else {
        throw error;
      }
    }
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
    const payload = { articleId: article.id };
    try {
      await articleQueue.add(
        `fetch-article-${article.id}`,
        payload,
        { jobId: `fetch-article-${article.id}`, removeOnComplete: 100, removeOnFail: 50 }
      );
    } catch (error) {
      if (isQueueUnavailableError(error)) {
        logger.warn({ articleId: article.id }, 'Article queue unavailable; running fetch inline');
        await processFetchArticleJob(payload, prisma, articleFetcher, impactFilter);
      } else {
        throw error;
      }
    }
  }

  if (pendingArticles.length > 0) {
    logger.info({ count: pendingArticles.length }, 'Queued pending articles for fetch');
  }
}

// Process fetched articles for enrichment (selective enrichment based on pre-filter)
async function processFetchedArticles() {
  if (config.worker.skipEnrichment) {
    const fetchedArticles = await prisma.article.findMany({
      where: {
        status: 'FETCHED',
        preFilterPassed: true,
        enrichment: null,
      },
      take: 10,
      orderBy: [
        { impactScore: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    for (const article of fetchedArticles) {
      try {
        const { category, sentiment } = EnrichmentMapper.detectFromTitle(article.titleOriginal);
        const mapped = EnrichmentMapper.mapEnrichment({
          externalCategory: category,
          externalSentiment: sentiment,
        });

        await prisma.enrichment.upsert({
          where: { articleId: article.id },
          create: {
            articleId: article.id,
            titleTh: null,
            summaryTh: null,
            takeawaysTh: [],
            tags: mapped.tags,
            sentiment: mapped.sentiment,
            marketImpact: mapped.marketImpact,
            hooksTh: [],
            threadTh: [],
            contentDraftTh: null,
            llmProvider: 'external-heuristic',
            llmModel: 'title-analysis',
          },
          update: {
            tags: mapped.tags,
            sentiment: mapped.sentiment,
            marketImpact: mapped.marketImpact,
            llmProvider: 'external-heuristic',
            llmModel: 'title-analysis',
          },
        });

        await prisma.article.update({
          where: { id: article.id },
          data: { status: 'ENRICHED' },
        });
      } catch (error) {
        logger.error(
          { articleId: article.id, error: (error as Error).message },
          'Heuristic enrichment failed'
        );
      }
    }

    if (fetchedArticles.length > 0) {
      logger.info({ count: fetchedArticles.length }, 'Heuristically enriched fetched articles');
    }

    return;
  }

  // With selective enrichment, only enrich articles that passed pre-filter
  const fetchedArticles = await prisma.article.findMany({
    where: {
      status: 'FETCHED',
      preFilterPassed: true, // Only enrich high-potential articles
    },
    take: 5,
    orderBy: [
      { impactScore: 'desc' }, // Prioritize by impact score
      { createdAt: 'asc' },
    ],
  });

  for (const article of fetchedArticles) {
    const payload = { articleId: article.id };
    try {
      await enrichQueue.add(
        `enrich-${article.id}`,
        payload,
        { jobId: `enrich-${article.id}`, removeOnComplete: 100, removeOnFail: 50 }
      );
    } catch (error) {
      if (isQueueUnavailableError(error)) {
        logger.warn({ articleId: article.id }, 'Enrich queue unavailable; running enrich inline');
        await processEnrichArticleJob(payload, prisma, llmProvider, config.llm.model);
      } else {
        throw error;
      }
    }
  }

  if (fetchedArticles.length > 0) {
    logger.info({ count: fetchedArticles.length }, 'Queued high-potential articles for enrichment');
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
    const payload = { postingId: posting.id, webhookUrl };
    try {
      await discordQueue.add(
        `post-${posting.id}`,
        payload,
        { jobId: `post-${posting.id}`, removeOnComplete: 100, removeOnFail: 50 }
      );
    } catch (error) {
      if (isQueueUnavailableError(error)) {
        logger.warn({ postingId: posting.id }, 'Discord queue unavailable; posting inline');
        await processPostDiscordWebhookJob(payload, prisma);
      } else {
        throw error;
      }
    }
  }

  if (pendingPostings.length > 0) {
    logger.info({ count: pendingPostings.length }, 'Queued pending Discord posts');
  }
}

// ============================================================
// High-impact article posting
// Posts enriched articles with HIGH market impact to Discord
// Limited to MAX_HIGH_IMPACT_POSTS_PER_DAY per day
// ============================================================
async function processHighImpactArticles() {
  if (!config.worker.enableHighImpactPosting) {
    return; // Feature disabled
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return; // No webhook configured
  }

  // Check daily quota
  const today = new Date().toISOString().split('T')[0];
  const quota = await prisma.highImpactQuota.findUnique({
    where: { date: new Date(today) },
  });

  const maxPerDay = parseInt(process.env.MAX_HIGH_IMPACT_POSTS_PER_DAY || '10', 10);
  if (quota && quota.postedCount >= maxPerDay) {
    return; // Quota exceeded for today
  }

  // Find enriched HIGH-impact articles not yet posted
  const candidates = await prisma.article.findMany({
    where: {
      status: 'ENRICHED',
      enrichment: { marketImpact: 'HIGH' },
      postings: { none: { postingType: 'HIGH_IMPACT' } },
    },
    include: {
      enrichment: true,
      source: true,
    },
    take: 3,
    orderBy: { publishedAt: 'desc' },
  });

  if (candidates.length === 0) {
    return;
  }

  const discordService = new DiscordWebhookService(webhookUrl);

  for (const article of candidates) {
    // Check quota again (might have changed in loop)
    const currentQuota = await prisma.highImpactQuota.upsert({
      where: { date: new Date(today) },
      create: { date: new Date(today), postedCount: 0 },
      update: {},
    });

    if (currentQuota.postedCount >= maxPerDay) {
      logger.info('High-impact quota reached for today');
      break;
    }

    try {
      if (!article.enrichment) {
        logger.warn({ articleId: article.id }, 'Skipping Discord post for article without enrichment');
        continue;
      }
      // Post to Discord
      await discordService.postArticle({
        ...article,
        enrichment: article.enrichment
      });

      // Increment quota
      await prisma.highImpactQuota.update({
        where: { date: new Date(today) },
        data: { postedCount: { increment: 1 } },
      });

      // Mark as posted
      await prisma.posting.create({
        data: {
          articleId: article.id,
          discordChannelId: 'high-impact-webhook',
          status: 'POSTED',
          postingType: 'HIGH_IMPACT',
          postedAt: new Date(),
        },
      });

      logger.info({
        articleId: article.id,
        title: article.titleOriginal.substring(0, 50),
        marketImpact: article.enrichment?.marketImpact,
      }, 'Posted high-impact article to Discord');

      // Rate limit: 30s between posts to avoid spam
      await sleep(30000);
    } catch (error) {
      logger.error({
        error: (error as Error).message,
        articleId: article.id,
      }, 'Failed to post high-impact article');

      // Create failed posting record
      await prisma.posting.create({
        data: {
          articleId: article.id,
          discordChannelId: 'high-impact-webhook',
          status: 'FAILED',
          postingType: 'HIGH_IMPACT',
          error: (error as Error).message,
        },
      });
    }
  }
}

// ============================================================
// Bi-daily summary scheduler
// Runs at 7:00 AM and 7:00 PM Bangkok time (00:00 and 12:00 UTC)
// ============================================================
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const SUMMARY_WINDOW_MS = 12 * 60 * 60 * 1000;
const SUMMARY_RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;
const scheduledSummaryKeys = new Set<string>();

function formatBangkokDateKey(dateBangkokProxy: Date): string {
  const y = dateBangkokProxy.getUTCFullYear();
  const m = String(dateBangkokProxy.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateBangkokProxy.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getSummarySlotsAroundNow(nowUtc: Date): Array<{
  scheduleType: 'morning' | 'evening';
  summaryKey: string;
  slotStartUtc: Date;
}> {
  const nowBangkokProxy = new Date(nowUtc.getTime() + BANGKOK_OFFSET_MS);

  const slotCandidates = [
    { dayOffset: -1, hour: 19, scheduleType: 'evening' as const },
    { dayOffset: 0, hour: 7, scheduleType: 'morning' as const },
    { dayOffset: 0, hour: 19, scheduleType: 'evening' as const },
    { dayOffset: 1, hour: 7, scheduleType: 'morning' as const },
  ];

  return slotCandidates
    .map((slot) => {
      const slotBangkokProxy = new Date(
        Date.UTC(
          nowBangkokProxy.getUTCFullYear(),
          nowBangkokProxy.getUTCMonth(),
          nowBangkokProxy.getUTCDate() + slot.dayOffset,
          slot.hour,
          0,
          0
        )
      );
      const slotStartUtc = new Date(slotBangkokProxy.getTime() - BANGKOK_OFFSET_MS);
      const dateKey = formatBangkokDateKey(slotBangkokProxy);
      const summaryKey = `${dateKey}-${slot.scheduleType}`;
      return { scheduleType: slot.scheduleType, slotStartUtc, summaryKey };
    })
    .filter((slot) => {
      const age = nowUtc.getTime() - slot.slotStartUtc.getTime();
      return age >= 0 && age <= SUMMARY_RECOVERY_WINDOW_MS;
    })
    .sort((a, b) => a.slotStartUtc.getTime() - b.slotStartUtc.getTime());
}

async function checkSummarySchedule() {
  const now = new Date();
  const candidateSlots = getSummarySlotsAroundNow(now);
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  for (const slot of candidateSlots) {
    const { scheduleType, summaryKey, slotStartUtc } = slot;

    // Skip if we already handled this slot in this process.
    if (scheduledSummaryKeys.has(summaryKey)) {
      continue;
    }

    // Double-check database to prevent duplicates across restarts.
    const recentSummary = await prisma.marketSummary.findFirst({
      where: {
        scheduleType,
        createdAt: {
          gte: slotStartUtc,
          lt: new Date(slotStartUtc.getTime() + SUMMARY_WINDOW_MS),
        },
      },
    });

    if (recentSummary) {
      scheduledSummaryKeys.add(summaryKey);
      logger.info({ scheduleType, summaryKey }, 'Summary already generated for this period, skipping');
      continue;
    }

    scheduledSummaryKeys.add(summaryKey);

    logger.info(
      { scheduleType, summaryKey, webhookConfigured: Boolean(webhookUrl) },
      'Scheduling bi-daily summary generation'
    );

    const payload = { scheduleType, webhookUrl };
    try {
      await summaryQueue.add(
        `summary-${summaryKey}`,
        payload,
        { jobId: `summary-${summaryKey}`, removeOnComplete: 50, removeOnFail: 20 }
      );
    } catch (error) {
      if (isQueueUnavailableError(error)) {
        logger.warn({ summaryKey }, 'Summary queue unavailable; running summary inline');
        await processGenerateSummaryJob(payload, prisma, llmProvider);
      } else {
        throw error;
      }
    }
  }
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
    const payload = {
      sourceId: source.id,
      sourceName: source.name,
      feedUrl: source.url,
      backfillHours: 24, // Last 24 hours on startup
    };
    try {
      await rssQueue.add(
        `backfill-${source.id}`,
        payload,
        { removeOnComplete: 100, removeOnFail: 50 }
      );
    } catch (error) {
      if (isQueueUnavailableError(error)) {
        logger.warn({ sourceId: source.id }, 'RSS backfill queue unavailable; running inline');
        await processFetchRSSJob(payload, prisma, rssFetcher);
      } else {
        throw error;
      }
    }
  }

  // Initial backfill - API sources
  logger.info('Running initial API backfill...');
  const apiSources = await prisma.source.findMany({
    where: { enabled: true, type: 'API' },
  });

  for (const source of apiSources) {
    const payload = {
      sourceId: source.id,
      sourceName: source.name,
      apiBaseUrl: source.url,
      backfillHours: 24, // Last 24 hours on startup
    };
    try {
      await apiNewsQueue.add(
        `backfill-api-${source.id}`,
        payload,
        { removeOnComplete: 100, removeOnFail: 50 }
      );
    } catch (error) {
      if (isQueueUnavailableError(error)) {
        logger.warn({ sourceId: source.id }, 'API backfill queue unavailable; running inline');
        await processFetchAPINewsJob(payload, prisma, apiNewsFetcher);
      } else {
        throw error;
      }
    }
  }

  // Scheduler loop
  const intervalMs = config.worker.fetchIntervalMinutes * 60 * 1000;
  let lastRSSFetch = Date.now();
  let lastAPIFetch = Date.now();

  logger.info({ intervalMinutes: config.worker.fetchIntervalMinutes }, 'Worker started, entering main loop');

  while (true) {
    // Keep each step isolated so one failure doesn't block summary checks.
    if (Date.now() - lastRSSFetch >= intervalMs) {
      try {
        await scheduleRSSFetches();
        lastRSSFetch = Date.now();
      } catch (error) {
        logger.error({ error: (error as Error).message }, 'Failed to schedule RSS fetches');
      }
    }

    if (Date.now() - lastAPIFetch >= intervalMs) {
      try {
        await scheduleAPINewsFetches();
        lastAPIFetch = Date.now();
      } catch (error) {
        logger.error({ error: (error as Error).message }, 'Failed to schedule API news fetches');
      }
    }

    try {
      await processPendingArticles();
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Failed to process pending articles');
    }

    try {
      await processFetchedArticles();
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Failed to process fetched articles');
    }

    try {
      await processEnrichedArticles();
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Failed to process enriched articles');
    }

    try {
      await processPendingPosts();
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Failed to process pending posts');
    }

    try {
      await processHighImpactArticles();
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Failed to process high-impact articles');
    }

    try {
      await checkSummarySchedule();
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Failed during summary scheduling check');
    }

    // Wait before next iteration
    await sleep(10000); // Check every 10 seconds
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
