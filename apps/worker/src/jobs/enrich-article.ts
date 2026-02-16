import { PrismaClient } from '@prisma/client';
import { createLogger, MIN_TEXT_FOR_ENRICHMENT, getSantimentSlug } from '@crypto-news/shared';
import type { LLMProviderInterface } from '@crypto-news/shared';
import { EnrichmentService } from '../services/enrichment.js';
import { FinnhubSentimentProvider, FMPSentimentProvider, aggregateSentiment } from '../services/sentiment/index.js';
import { SantimentProvider } from '../services/onchain/santiment.js';

const logger = createLogger('worker:job:enrich-article');

export interface EnrichArticleJobData {
  articleId: string;
}

export async function processEnrichArticleJob(
  data: EnrichArticleJobData,
  prisma: PrismaClient,
  llmProvider: LLMProviderInterface,
  llmModel: string
): Promise<{ success: boolean }> {
  const { articleId } = data;

  logger.info({ articleId }, 'Processing article enrichment job');

  // Get article
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { source: true },
  });

  if (!article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  if (article.status === 'ENRICHED') {
    logger.info({ articleId }, 'Article already enriched, skipping');
    return { success: true };
  }

  if (article.status !== 'FETCHED') {
    throw new Error(`Article not in FETCHED status: ${article.status}`);
  }

  if (!article.extractedText || article.extractedText.trim().length === 0) {
    logger.info({ articleId }, 'Article has no extracted text, marking as SKIPPED');
    await prisma.article.update({
      where: { id: articleId },
      data: { status: 'SKIPPED' },
    });
    return { success: true };
  }

  // Quality gate: skip articles with too little text — not worth LLM tokens
  if (article.extractedText.length < MIN_TEXT_FOR_ENRICHMENT) {
    logger.info(
      { articleId, textLength: article.extractedText.length, threshold: MIN_TEXT_FOR_ENRICHMENT },
      'Article text below enrichment threshold, marking as SKIPPED'
    );
    await prisma.article.update({
      where: { id: articleId },
      data: { status: 'SKIPPED' },
    });
    return { success: true };
  }

  // Audit start
  await prisma.jobAudit.create({
    data: {
      jobType: 'ENRICH_ARTICLE',
      articleId,
      status: 'STARTED',
    },
  });

  try {
    // Create enrichment service
    const enrichmentService = new EnrichmentService(llmProvider);

    // Enrich article
    const enrichment = await enrichmentService.enrich({
      articleText: article.extractedText,
      articleTitle: article.titleOriginal,
      sourceName: article.source.name,
      publishedAt: article.publishedAt || undefined,
      url: article.url,
    });

    // Fetch external sentiment data (non-blocking, best-effort)
    let finnhubSentiment = null;
    let fmpSentiment = null;

    if (process.env.ENABLE_EXTERNAL_SENTIMENT === 'true') {
      try {
        // Find primary crypto tag for sentiment analysis
        const primaryTag = enrichment.tags.find((tag: string) =>
          ['BTC', 'ETH', 'SOL', 'HYPE', 'XRP', 'Bitcoin', 'Ethereum', 'Solana'].includes(tag)
        );

        if (primaryTag) {
          // Fetch sentiment from external APIs in parallel
          const [finnhubData, fmpData] = await Promise.allSettled([
            (async () => {
              if (!process.env.FINNHUB_API_KEY) return null;
              const provider = new FinnhubSentimentProvider(process.env.FINNHUB_API_KEY);
              const symbol = FinnhubSentimentProvider.mapTagToSymbol(primaryTag);
              return symbol ? await provider.fetchSentiment(symbol) : null;
            })(),
            (async () => {
              if (!process.env.FMP_API_KEY) return null;
              const provider = new FMPSentimentProvider(process.env.FMP_API_KEY);
              const ticker = FMPSentimentProvider.mapTagToTicker(primaryTag);
              return ticker ? await provider.fetchSentiment(ticker) : null;
            })(),
          ]);

          finnhubSentiment = finnhubData.status === 'fulfilled' ? finnhubData.value : null;
          fmpSentiment = fmpData.status === 'fulfilled' ? fmpData.value : null;

          logger.info({
            articleId,
            primaryTag,
            hasFinnhub: !!finnhubSentiment,
            hasFMP: !!fmpSentiment,
          }, 'External sentiment fetched');
        }
      } catch (error) {
        logger.warn({ error: (error as Error).message }, 'Failed to fetch external sentiment, continuing without it');
      }
    }

    // Aggregate sentiment from all sources
    const aggregated = aggregateSentiment(
      enrichment.sentiment,
      finnhubSentiment,
      fmpSentiment
    );

    // Fetch on-chain metrics (non-blocking, best-effort)
    let santimentMetrics: Record<string, unknown> | null = null;

    if (process.env.ENABLE_ONCHAIN_METRICS === 'true' && process.env.SANTIMENT_API_KEY) {
      try {
        const santimentProvider = new SantimentProvider(process.env.SANTIMENT_API_KEY);

        // Fetch metrics for all relevant tokens mentioned in tags
        const metricsPromises = enrichment.tags
          .map((tag: string) => getSantimentSlug(tag))
          .filter((slug): slug is string => slug !== null)
          .slice(0, 3) // Limit to 3 tokens to conserve API quota
          .map(async (slug) => {
            const metrics = await santimentProvider.fetchMetrics(slug);
            return metrics ? { [slug]: metrics } : null;
          });

        const metricsResults = await Promise.all(metricsPromises);
        const metricsMap = metricsResults
          .filter((m): m is Record<string, unknown> => m !== null)
          .reduce((acc, m) => ({ ...acc, ...m }), {});

        if (Object.keys(metricsMap).length > 0) {
          santimentMetrics = metricsMap;
          logger.info({
            articleId,
            tokenCount: Object.keys(metricsMap).length,
          }, 'Santiment metrics fetched');
        }
      } catch (error) {
        logger.warn({ error: (error as Error).message }, 'Failed to fetch Santiment metrics, continuing without it');
      }
    }

    // Store enrichment (upsert to handle race conditions)
    const enrichmentData = {
      articleId,
      titleTh: enrichment.title_th,
      summaryTh: enrichment.summary_th,
      takeawaysTh: [],
      tags: enrichment.tags,
      sentiment: aggregated.sentiment.toUpperCase() as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
      marketImpact: enrichment.market_impact.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
      hooksTh: [],
      threadTh: [],
      contentDraftTh: null,
      cautions: enrichment.cautions || [],
      mustQuote: enrichment.must_quote || [],
      finnhubSentiment: finnhubSentiment ? JSON.parse(JSON.stringify(finnhubSentiment)) : null,
      fmpSentiment: fmpSentiment ? JSON.parse(JSON.stringify(fmpSentiment)) : null,
      sentimentConfidence: aggregated.confidence,
      santimentMetrics: santimentMetrics ? JSON.parse(JSON.stringify(santimentMetrics)) : null,
      metricsFetchedAt: santimentMetrics ? new Date() : null,
      llmModel,
      llmProvider: llmProvider.name,
    };

    await prisma.enrichment.upsert({
      where: { articleId },
      create: enrichmentData,
      update: enrichmentData,
    });

    // Update article status
    await prisma.article.update({
      where: { id: articleId },
      data: { status: 'ENRICHED' },
    });

    // Audit complete
    await prisma.jobAudit.create({
      data: {
        jobType: 'ENRICH_ARTICLE',
        articleId,
        status: 'COMPLETED',
        metadata: {
          tags: enrichment.tags,
          sentiment: enrichment.sentiment,
          marketImpact: enrichment.market_impact,
        },
      },
    });

    logger.info(
      {
        articleId,
        tags: enrichment.tags,
        sentiment: enrichment.sentiment,
      },
      'Article enrichment job completed'
    );

    return { success: true };
  } catch (error) {
    // Mark as failed
    await prisma.article.update({
      where: { id: articleId },
      data: { status: 'FAILED' },
    });

    // Audit failure
    await prisma.jobAudit.create({
      data: {
        jobType: 'ENRICH_ARTICLE',
        articleId,
        status: 'FAILED',
        error: (error as Error).message,
      },
    });

    logger.error({ error: (error as Error).message, articleId }, 'Article enrichment job failed');
    throw error;
  }
}
