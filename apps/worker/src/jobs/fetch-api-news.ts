import { PrismaClient } from '@prisma/client';
import { createLogger, normalizeUrl, createArticleHash, isDuplicateArticle, isNoiseTitle, isBlockedSource } from '@crypto-news/shared';
import { EnrichmentMapper } from '../services/enrichment-mapper.js';
import type { APINewsFetcher } from '../services/api-news-fetcher.js';

const logger = createLogger('worker:job:fetch-api-news');
const JOB_TYPE = 'FETCH_API_NEWS';

export interface FetchAPINewsJobData {
  sourceId: string;
  sourceName: string;
  apiBaseUrl: string;
  backfillHours?: number;
}

export async function processFetchAPINewsJob(
  data: FetchAPINewsJobData,
  prisma: PrismaClient,
  apiFetcher: APINewsFetcher
): Promise<{ newArticles: number; duplicates: number; skipped: number; errors: number }> {
  const { sourceId, sourceName, apiBaseUrl, backfillHours } = data;
  const sourceApiFetcher = apiBaseUrl ? apiFetcher.withBaseUrl(apiBaseUrl) : apiFetcher;

  logger.info({ sourceId, sourceName, backfillHours }, 'Processing API news fetch job');

  // Audit start
  await prisma.jobAudit.create({
    data: {
      jobType: JOB_TYPE,
      status: 'STARTED',
      metadata: { sourceId, sourceName, type: 'API' },
    },
  });

  let newArticles = 0;
  let duplicates = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Calculate since date for backfill
    const since = backfillHours
      ? new Date(Date.now() - backfillHours * 60 * 60 * 1000)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default 24 hours

    // Fetch latest news from API
    const newsItems = await sourceApiFetcher.fetchLatestNews({
      limit: 100, // Fetch more since we have 200+ sources
      since,
    });

    logger.info(
      { count: newsItems.length, sourceId, sourceName },
      'Fetched news items from API'
    );

    // Get recent articles for deduplication check
    const recentArticles = await prisma.article.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      select: {
        urlNormalized: true,
        titleOriginal: true,
        hash: true,
      },
    });

    // Process each news item
    for (const item of newsItems) {
      try {
        // Check for blocked sources (e.g. TradingView user chart ideas)
        if (isBlockedSource(item.source, item.url)) {
          skipped++;
          logger.debug(
            { url: item.url, source: item.source },
            'Skipping blocked source'
          );
          continue;
        }

        const normalizedUrl = normalizeUrl(item.url);
        const hash = createArticleHash(item.title, item.url, item.publishedAt);

        // Check for duplicates
        const existingByHash = recentArticles.find((a) => a.hash === hash);
        if (existingByHash) {
          duplicates++;
          logger.debug({ url: item.url, title: item.title }, 'Skipping duplicate (hash match)');
          continue;
        }

        const existingByUrl = recentArticles.find((a) => a.urlNormalized === normalizedUrl);
        if (existingByUrl) {
          duplicates++;
          logger.debug({ url: item.url, title: item.title }, 'Skipping duplicate (URL match)');
          continue;
        }

        // Check title similarity
        const similar = recentArticles.find((a) =>
          isDuplicateArticle(
            { titleOriginal: a.titleOriginal, urlNormalized: a.urlNormalized },
            { title: item.title, url: item.url }
          )
        );

        if (similar) {
          duplicates++;
          logger.debug(
            { url: item.url, title: item.title },
            'Skipping duplicate (title similarity)'
          );
          continue;
        }

        // Check for noise / low-value content
        const noiseReason = isNoiseTitle(item.title);
        if (noiseReason) {
          skipped++;
          logger.debug(
            { url: item.url, title: item.title, reason: noiseReason },
            'Skipping noise article'
          );
          continue;
        }

        // Create new article
        await prisma.article.create({
          data: {
            sourceId,
            originalSourceName: item.source, // Store original outlet (CNBC, Crypto.news, etc.)
            url: item.url,
            urlNormalized: normalizedUrl,
            titleOriginal: item.title,
            publishedAt: item.publishedAt,
            hash,
            // Use API provided summary as extracted text
            extractedText: item.summary || '',
            status: 'ENRICHED', // Mark as enriched since we have API data
            language: 'en', // API auto-translates to English
            // Map impact score for compatibility
            impactScore: EnrichmentMapper.mapEnrichment(item.enrichmentData || {}, item.title).marketImpact === 'HIGH' ? 0.9 :
              EnrichmentMapper.mapEnrichment(item.enrichmentData || {}, item.title).marketImpact === 'MEDIUM' ? 0.5 : 0.1,
            preFilterPassed: true,

            // Create enrichment record immediately
            enrichment: {
              create: {
                ...EnrichmentMapper.mapEnrichment(item.enrichmentData || {}, item.title),
                titleTh: null,
                summaryTh: null,
                takeawaysTh: [],
                hooksTh: [],
                threadTh: [],
                contentDraftTh: null,
                llmModel: 'API_SOURCE',
                llmProvider: 'API_SOURCE',
              }
            }
          },
        });

        newArticles++;
        logger.debug({ url: item.url, title: item.title }, 'Created new article');

        // Add to recent articles for next iteration's dedup check
        recentArticles.push({
          urlNormalized: normalizedUrl,
          titleOriginal: item.title,
          hash,
        });
      } catch (error) {
        errors++;
        logger.error(
          { error: (error as Error).message, url: item.url },
          'Error creating article'
        );
      }
    }

    // Audit complete
    await prisma.jobAudit.create({
      data: {
        jobType: JOB_TYPE,
        status: 'COMPLETED',
        metadata: {
          sourceId,
          sourceName,
          type: 'API',
          newArticles,
          duplicates,
          skipped,
          errors,
        },
      },
    });

    logger.info(
      { sourceId, sourceName, newArticles, duplicates, skipped, errors },
      'API news fetch job completed'
    );

    return { newArticles, duplicates, skipped, errors };
  } catch (error) {
    // Audit failure
    await prisma.jobAudit.create({
      data: {
        jobType: JOB_TYPE,
        status: 'FAILED',
        error: (error as Error).message,
        metadata: { sourceId, sourceName, type: 'API' },
      },
    });

    logger.error(
      { error: (error as Error).message, sourceId, sourceName },
      'API news fetch job failed'
    );
    throw error;
  }
}
