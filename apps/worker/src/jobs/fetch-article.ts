import { PrismaClient } from '@prisma/client';
import { createLogger, createArticleHash } from '@crypto-news/shared';
import { ArticleFetcher } from '../services/article-fetcher.js';
import type { ImpactFilter } from '../services/impact-filter.js';

const logger = createLogger('worker:job:fetch-article');

export interface FetchArticleJobData {
  articleId: string;
}

export async function processFetchArticleJob(
  data: FetchArticleJobData,
  prisma: PrismaClient,
  articleFetcher: ArticleFetcher,
  impactFilter?: ImpactFilter
): Promise<{ success: boolean; extractedLength: number }> {
  const { articleId } = data;

  logger.info({ articleId }, 'Processing article fetch job');

  // Get article
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { source: true },
  });

  if (!article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  // Audit start
  await prisma.jobAudit.create({
    data: {
      jobType: 'FETCH_ARTICLE',
      articleId,
      status: 'STARTED',
    },
  });

  try {
    // Fetch and extract article content
    const fetched = await articleFetcher.fetch(article.url);

    // Update title if we got a better one from extraction
    const titleOriginal = fetched.title || article.titleOriginal;

    // Recreate hash if title changed
    const hash = createArticleHash(titleOriginal, article.url, article.publishedAt || undefined);

    // Run impact pre-filter if enabled
    let impactScore: number | null = null;
    let preFilterPassed = false;

    if (impactFilter && fetched.extractedText.length >= 200) {
      try {
        const evaluation = await impactFilter.evaluateImpact({
          titleOriginal,
          extractedText: fetched.extractedText,
          sourceName: article.source.name,
        });

        impactScore = evaluation.score;
        preFilterPassed = evaluation.shouldEnrich;

        logger.info({
          articleId,
          impactScore,
          preFilterPassed,
          title: titleOriginal.substring(0, 50),
        }, 'Impact pre-filter evaluated');
      } catch (error) {
        logger.warn({
          error: (error as Error).message,
          articleId,
        }, 'Impact pre-filter failed, defaulting to pass');
        // On error, default to pass (enrich anyway)
        preFilterPassed = true;
      }
    } else if (!impactFilter) {
      // If no impact filter provided, pass all articles
      preFilterPassed = true;
    }

    // Update article with fetch results and impact score
    await prisma.article.update({
      where: { id: articleId },
      data: {
        rawHtml: fetched.rawHtml,
        extractedText: fetched.extractedText,
        titleOriginal,
        hash,
        impactScore,
        preFilterPassed,
        status: 'FETCHED',
      },
    });

    // Audit complete
    await prisma.jobAudit.create({
      data: {
        jobType: 'FETCH_ARTICLE',
        articleId,
        status: 'COMPLETED',
        metadata: { extractedLength: fetched.extractedText.length },
      },
    });

    logger.info({ articleId, extractedLength: fetched.extractedText.length }, 'Article fetch job completed');

    return {
      success: true,
      extractedLength: fetched.extractedText.length,
    };
  } catch (error) {
    // Mark as failed
    await prisma.article.update({
      where: { id: articleId },
      data: { status: 'FAILED' },
    });

    // Audit failure
    await prisma.jobAudit.create({
      data: {
        jobType: 'FETCH_ARTICLE',
        articleId,
        status: 'FAILED',
        error: (error as Error).message,
      },
    });

    logger.error({ error: (error as Error).message, articleId }, 'Article fetch job failed');
    throw error;
  }
}
