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

function computeOpportunityBoost(params: {
  title: string;
  tags: string[];
  opportunityAssets: Set<string>;
}): number {
  const { title, tags, opportunityAssets } = params;
  if (opportunityAssets.size === 0) return 0;

  const haystack = `${title} ${tags.join(' ')}`.toUpperCase();
  let boost = 0;
  for (const asset of opportunityAssets) {
    const token = asset.toUpperCase();
    const regex = new RegExp(`\\b${token}\\b`, 'i');
    if (regex.test(haystack)) {
      boost += 1;
    }
  }
  return boost;
}

export async function GET(request: NextRequest) {
  try {
    const { prisma } = await import('@/lib/prisma');
    const searchParams = request.nextUrl.searchParams;
    const tag = searchParams.get('tag');
    const sentiment = searchParams.get('sentiment');
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    const impactFilter = searchParams.get('impact')?.toUpperCase();

    const where: Prisma.ArticleWhereInput = {
      status: { in: ['FETCHED', 'ENRICHED'] },
    };

    const enrichmentWhere: Prisma.EnrichmentWhereInput = {};

    if (impactFilter && ['LOW', 'MEDIUM', 'HIGH'].includes(impactFilter)) {
      enrichmentWhere.marketImpact = impactFilter as 'LOW' | 'MEDIUM' | 'HIGH';
    } else {
      enrichmentWhere.marketImpact = { in: ['MEDIUM', 'HIGH'] };
    }
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

    let opportunityAssets = new Set<string>();
    try {
      const latestOpportunity = await prisma.opportunitySnapshot.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          opportunities: {
            orderBy: [{ finalScore: 'desc' }, { scanStreak: 'desc' }],
            take: 20,
          },
        },
      });
      if (latestOpportunity) {
        opportunityAssets = new Set(
          latestOpportunity.opportunities
            .map((item) => item.asset)
            .filter((asset): asset is string => typeof asset === 'string' && asset.trim() !== '')
        );
      }
    } catch {
      // Do not fail article feed if signals table is unavailable.
    }

    const dedupedItems = [];
    const seenHeadlineKeys = new Set<string>();
    for (const article of articles) {
      const sourceName = article.originalSourceName || article.source.name;
      const headlineKey = `${sourceName.toLowerCase()}|${normalizeHeadlineKey(article.titleOriginal)}`;
      if (seenHeadlineKeys.has(headlineKey)) continue;
      seenHeadlineKeys.add(headlineKey);
      dedupedItems.push(article);
      if (dedupedItems.length >= limit * 2 + 1) break;
    }

    const rankedItems = dedupedItems.sort((a, b) => {
      const aTags = toStringArray(a.enrichment?.tags);
      const bTags = toStringArray(b.enrichment?.tags);
      const aBoost = computeOpportunityBoost({
        title: a.titleOriginal,
        tags: aTags,
        opportunityAssets,
      });
      const bBoost = computeOpportunityBoost({
        title: b.titleOriginal,
        tags: bTags,
        opportunityAssets,
      });
      if (aBoost !== bBoost) return bBoost - aBoost;

      const aTs = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTs = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTs - aTs;
    });

    const hasMore = rankedItems.length > limit;
    const items = rankedItems.slice(0, limit);

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
