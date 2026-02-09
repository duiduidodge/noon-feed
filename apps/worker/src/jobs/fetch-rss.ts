import { PrismaClient } from '@prisma/client';
import { createLogger, normalizeUrl, createArticleHash, isDuplicateArticle, isNoiseTitle } from '@crypto-news/shared';
import type { RSSItem } from '@crypto-news/shared';
import { RSSFetcher } from '../services/rss-fetcher.js';

const logger = createLogger('worker:job:fetch-rss');

export interface FetchRSSJobData {
  sourceId: string;
  sourceName: string;
  feedUrl: string;
  backfillHours?: number;
}

export async function processFetchRSSJob(
  data: FetchRSSJobData,
  prisma: PrismaClient,
  rssFetcher: RSSFetcher
): Promise<{ newArticles: number; skipped: number }> {
  const { sourceId, sourceName, feedUrl, backfillHours } = data;

  logger.info({ sourceId, sourceName, feedUrl }, 'Processing RSS fetch job');

  // Audit start
  await prisma.jobAudit.create({
    data: {
      jobType: 'FETCH_RSS',
      status: 'STARTED',
      metadata: { sourceId, feedUrl },
    },
  });

  try {
    // Fetch RSS feed
    let fetchResult;
    if (backfillHours) {
      const since = new Date(Date.now() - backfillHours * 60 * 60 * 1000);
      fetchResult = await rssFetcher.fetchSince(feedUrl, since);
    } else {
      fetchResult = await rssFetcher.fetch(feedUrl);
    }

    const { items } = fetchResult;
    let newArticles = 0;
    let skipped = 0;

    // Get existing articles for duplicate check
    const existingArticles = await prisma.article.findMany({
      where: { sourceId },
      select: { titleOriginal: true, urlNormalized: true },
      orderBy: { createdAt: 'desc' },
      take: 500, // Check against last 500 articles
    });

    // Process each item
    for (const item of items) {
      try {
        if (!item.link) {
          logger.warn({ item: item.title }, 'RSS item missing link, skipping');
          skipped++;
          continue;
        }

        // Check for noise / low-value content
        const noiseReason = isNoiseTitle(item.title);
        if (noiseReason) {
          logger.debug({ title: item.title, reason: noiseReason }, 'Skipping noise article');
          skipped++;
          continue;
        }

        const normalizedUrl = normalizeUrl(item.link);

        // Check for URL duplicate
        const urlExists = await prisma.article.findUnique({
          where: { urlNormalized: normalizedUrl },
        });

        if (urlExists) {
          logger.debug({ url: item.link }, 'Article already exists (URL match)');
          skipped++;
          continue;
        }

        // Check for title similarity
        const isDupe = existingArticles.some((existing) =>
          isDuplicateArticle(existing, { title: item.title, url: item.link })
        );

        if (isDupe) {
          logger.debug({ title: item.title }, 'Article already exists (title similarity)');
          skipped++;
          continue;
        }

        // Create hash
        const publishedAt = item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : undefined;
        const hash = createArticleHash(item.title, item.link, publishedAt);

        // Check hash collision
        const hashExists = await prisma.article.findUnique({
          where: { hash },
        });

        if (hashExists) {
          logger.debug({ hash }, 'Article already exists (hash match)');
          skipped++;
          continue;
        }

        // Create article record
        await prisma.article.create({
          data: {
            sourceId,
            url: item.link,
            urlNormalized: normalizedUrl,
            titleOriginal: item.title,
            publishedAt: publishedAt,
            hash,
            status: 'PENDING',
          },
        });

        newArticles++;
        logger.info({ title: item.title, url: item.link }, 'New article created');
      } catch (error) {
        logger.error({ error: (error as Error).message, item: item.title }, 'Error processing RSS item');
      }
    }

    // Audit complete
    await prisma.jobAudit.create({
      data: {
        jobType: 'FETCH_RSS',
        status: 'COMPLETED',
        metadata: { sourceId, newArticles, skipped, totalItems: items.length },
      },
    });

    logger.info({ sourceId, newArticles, skipped, total: items.length }, 'RSS fetch job completed');

    return { newArticles, skipped };
  } catch (error) {
    // Audit failure
    await prisma.jobAudit.create({
      data: {
        jobType: 'FETCH_RSS',
        status: 'FAILED',
        error: (error as Error).message,
        metadata: { sourceId },
      },
    });

    logger.error({ error: (error as Error).message, sourceId }, 'RSS fetch job failed');
    throw error;
  }
}
