import { NextRequest, NextResponse } from 'next/server';
import type { Prisma, Sentiment } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_SENTIMENTS: Sentiment[] = ['BULLISH', 'BEARISH', 'NEUTRAL'];

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeHeadlineKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(request: NextRequest) {
  try {
    const { prisma } = await import('@/lib/prisma');
    const searchParams = request.nextUrl.searchParams;
    const tag = searchParams.get('tag');
    const sentiment = searchParams.get('sentiment');
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    const where: Prisma.ArticleWhereInput = {
      status: { in: ['FETCHED', 'ENRICHED'] },
    };

    const enrichmentWhere: Prisma.EnrichmentWhereInput = {};
    if (tag) enrichmentWhere.tags = { array_contains: [tag] };

    const sentimentFilter = sentiment?.toUpperCase();
    if (sentimentFilter && VALID_SENTIMENTS.includes(sentimentFilter as Sentiment)) {
      enrichmentWhere.sentiment = sentimentFilter as Sentiment;
    }

    if (Object.keys(enrichmentWhere).length > 0) {
      where.enrichment = { is: enrichmentWhere };
    }

    const articles = await prisma.article.findMany({
      where,
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
            titleTh: true,
            summaryTh: true,
            sentiment: true,
            marketImpact: true,
            tags: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit * 4,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const dedupedItems = [];
    const seenHeadlineKeys = new Set<string>();
    for (const article of articles) {
      const sourceName = article.originalSourceName || article.source.name;
      const headlineKey = `${sourceName.toLowerCase()}|${normalizeHeadlineKey(article.titleOriginal)}`;
      if (seenHeadlineKeys.has(headlineKey)) continue;
      seenHeadlineKeys.add(headlineKey);
      dedupedItems.push(article);
      if (dedupedItems.length >= limit + 1) break;
    }

    const hasMore = dedupedItems.length > limit;
    const items = dedupedItems.slice(0, limit);

    const feedArticles = items.map((article) => ({
      id: article.id,
      title: article.titleOriginal,
      snippet: article.extractedText
        ? article.extractedText.substring(0, 200).replace(/\s+\S*$/, '') + '...'
        : '',
      sourceName: article.originalSourceName || article.source.name,
      publishedAt: article.publishedAt?.toISOString() || null,
      url: article.url,
      sentiment: article.enrichment?.sentiment || 'NEUTRAL',
      marketImpact: article.enrichment?.marketImpact || 'LOW',
      tags: toStringArray(article.enrichment?.tags),
    }));

    return NextResponse.json(
      {
        articles: feedArticles,
        nextCursor: hasMore ? items[items.length - 1].id : null,
        hasMore,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch feed articles:', error);
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}
