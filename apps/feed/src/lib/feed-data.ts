import type { FeedArticle } from '@/components/news-card';
import { prisma } from '@/lib/prisma';

export async function getInitialArticles(): Promise<FeedArticle[]> {
  try {
    const articles = await prisma.article.findMany({
      where: {
        status: { in: ['FETCHED', 'ENRICHED'] },
      },
      select: {
        id: true,
        titleOriginal: true,
        url: true,
        publishedAt: true,
        extractedText: true,
        originalSourceName: true,
        source: { select: { name: true } },
        enrichment: {
          select: {
            sentiment: true,
            marketImpact: true,
            tags: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });

    const seenHeadlineKeys = new Set<string>();
    const dedupedArticles = [];
    for (const article of articles) {
      const sourceName = article.originalSourceName || article.source.name;
      const headlineKey = `${sourceName.toLowerCase()}|${article.titleOriginal
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()}`;
      if (seenHeadlineKeys.has(headlineKey)) continue;
      seenHeadlineKeys.add(headlineKey);
      dedupedArticles.push(article);
    }

    return dedupedArticles.map((article) => ({
      id: article.id,
      title: article.titleOriginal,
      snippet: article.extractedText
        ? article.extractedText.substring(0, 220).replace(/\s+\S*$/, '') + '...'
        : '',
      sourceName: article.originalSourceName || article.source.name,
      publishedAt: article.publishedAt?.toISOString() || null,
      url: article.url,
      sentiment: article.enrichment?.sentiment || 'NEUTRAL',
      marketImpact: article.enrichment?.marketImpact || 'LOW',
      tags: (article.enrichment?.tags as string[]) || [],
    }));
  } catch (error) {
    console.error('Failed to fetch initial feed articles:', error);
    return [];
  }
}
