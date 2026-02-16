import { PrismaClient } from '@prisma/client';
import { createLogger } from '@crypto-news/shared';
import { EnrichmentMapper } from '../services/enrichment-mapper.js';

const logger = createLogger('worker:cli:enrich-from-api');
const prisma = new PrismaClient();

/**
 * Apply free enrichment mapping to API-sourced articles
 * Uses cryptocurrency.cv's sentiment + category data (NO LLM COST!)
 */
async function enrichFromAPIData() {
  // Find fetched articles without enrichment (both RSS and API)
  const articles = await prisma.article.findMany({
    where: {
      status: 'FETCHED',
      enrichment: null,
      // Both API and RSS sources - we'll enrich everything with heuristics
    },
    include: {
      source: true,
    },
    take: 100,
    orderBy: { publishedAt: 'desc' },
  });

  logger.info({ count: articles.length }, 'Found articles to enrich from API data');

  let enriched = 0;
  let skipped = 0;

  for (const article of articles) {
    try {
      // For now, we'll derive from article properties
      // In the future, we could store external enrichment data in a JSON field
      // For this first pass, let's use basic heuristics

      // Detect category and sentiment from title using shared heuristics
      const { category, sentiment } = EnrichmentMapper.detectFromTitle(article.titleOriginal);

      // Map using our enrichment mapper
      const mapped = EnrichmentMapper.mapEnrichment({
        externalCategory: category,
        externalSentiment: sentiment,
      });

      // Create enrichment with article connection
      await prisma.enrichment.create({
        data: {
          article: {
            connect: { id: article.id },
          },
          sentiment: mapped.sentiment,
          marketImpact: mapped.marketImpact,
          tags: mapped.tags,
          // No Thai translations yet (null)
          titleTh: null,
          summaryTh: null,
          takeawaysTh: [],
          hooksTh: [],
          threadTh: [],
          contentDraftTh: null,
          cautions: [],
          mustQuote: [],
          llmProvider: 'external-heuristic',
          llmModel: 'title-analysis',
          finnhubSentiment: null,
          fmpSentiment: null,
          sentimentConfidence: null,
          santimentMetrics: null,
          metricsFetchedAt: null,
        },
      });

      // Update article status
      await prisma.article.update({
        where: { id: article.id },
        data: { status: 'ENRICHED' },
      });

      enriched++;
      logger.debug(
        {
          articleId: article.id,
          title: article.titleOriginal.substring(0, 60),
          category,
          sentiment,
          mapped,
        },
        'Enriched article from API data'
      );
    } catch (error) {
      skipped++;
      logger.error(
        {
          error: (error as Error).message,
          articleId: article.id,
        },
        'Failed to enrich article'
      );
    }
  }

  logger.info({ enriched, skipped }, 'Completed API enrichment');
}

async function main() {
  logger.info('Starting API enrichment run');
  await enrichFromAPIData();
  logger.info('API enrichment run complete');
}

main()
  .catch((error) => {
    logger.error(
      { error: (error as Error).message, stack: (error as Error).stack },
      'API enrichment run failed'
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
