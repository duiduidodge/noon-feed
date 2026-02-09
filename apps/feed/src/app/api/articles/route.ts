import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tag = searchParams.get('tag');
    const sentiment = searchParams.get('sentiment');
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    const where: any = {
      status: { in: ['FETCHED', 'ENRICHED'] },
    };

    if (tag) {
      where.enrichment = {
        isNot: null,
        tags: { array_contains: [tag] },
      };
    }

    if (sentiment && ['BULLISH', 'BEARISH', 'NEUTRAL'].includes(sentiment)) {
      where.enrichment = {
        ...where.enrichment,
        isNot: null,
        sentiment: sentiment,
      };
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
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = articles.length > limit;
    const items = articles.slice(0, limit);

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
      tags: (article.enrichment?.tags as string[]) || [],
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
