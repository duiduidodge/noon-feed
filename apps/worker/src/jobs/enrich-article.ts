import { PrismaClient } from '@prisma/client';
import { createLogger, MIN_TEXT_FOR_ENRICHMENT } from '@crypto-news/shared';
import type { LLMProviderInterface } from '@crypto-news/shared';
import { EnrichmentService } from '../services/enrichment.js';

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

    // Store enrichment (upsert to handle race conditions)
    const enrichmentData = {
      articleId,
      titleTh: enrichment.title_th,
      summaryTh: enrichment.summary_th,
      takeawaysTh: [],
      tags: enrichment.tags,
      sentiment: enrichment.sentiment.toUpperCase() as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
      marketImpact: enrichment.market_impact.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
      hooksTh: [],
      threadTh: [],
      contentDraftTh: null,
      cautions: enrichment.cautions || [],
      mustQuote: enrichment.must_quote || [],
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
