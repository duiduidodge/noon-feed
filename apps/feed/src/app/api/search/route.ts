import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sanitizeSearchQuery, detectLanguage } from '@crypto-news/shared';

const prisma = new PrismaClient();

// Cache for 30 seconds
const CACHE_DURATION = 30;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const tags = searchParams.getAll('tags');
    const sentiment = searchParams.get('sentiment');

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const sanitizedQuery = sanitizeSearchQuery(query);
    const lang = detectLanguage(query);

    if (!sanitizedQuery) {
      return NextResponse.json(
        { error: 'Invalid search query' },
        { status: 400 }
      );
    }

    let searchResults: { id: string; rank: number }[] = [];

    // Search English content
    if (lang === 'en' || lang === 'auto') {
      const enResults = await prisma.$queryRaw<{ id: string; rank: number }[]>`
        SELECT
          a.id,
          ts_rank(a.search_vector_en, plainto_tsquery('english', ${sanitizedQuery})) as rank
        FROM "Article" a
        WHERE a.search_vector_en @@ plainto_tsquery('english', ${sanitizedQuery})
        AND a.status IN ('FETCHED', 'ENRICHED')
        ORDER BY rank DESC
        LIMIT ${limit}
      `;
      searchResults = [...searchResults, ...enResults];
    }

    // Search Thai content
    if (lang === 'th' || lang === 'auto') {
      const thResults = await prisma.$queryRaw<{ id: string; rank: number }[]>`
        SELECT
          a.id,
          ts_rank(e.search_vector_th, plainto_tsquery('simple', ${sanitizedQuery})) as rank
        FROM "Article" a
        INNER JOIN "Enrichment" e ON e."articleId" = a.id
        WHERE e.search_vector_th @@ plainto_tsquery('simple', ${sanitizedQuery})
        AND a.status = 'ENRICHED'
        ORDER BY rank DESC
        LIMIT ${limit}
      `;
      searchResults = [...searchResults, ...thResults];
    }

    // Sort by rank and deduplicate
    searchResults.sort((a, b) => b.rank - a.rank);
    const uniqueIds = [...new Set(searchResults.map(r => r.id))];
    const topIds = uniqueIds.slice(0, limit);

    if (topIds.length === 0) {
      return NextResponse.json(
        { items: [], total: 0, query },
        {
          headers: {
            'Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=${CACHE_DURATION * 2}`,
          },
        }
      );
    }

    // Build filters
    interface EnrichmentFilter {
      tags?: { array_contains: string[] };
      sentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    }

    const enrichmentFilter: EnrichmentFilter = {};

    if (tags.length > 0) {
      enrichmentFilter.tags = { array_contains: tags };
    }

    if (sentiment) {
      enrichmentFilter.sentiment = sentiment.toUpperCase() as 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    }

    // Fetch full articles with filters
    const articles = await prisma.article.findMany({
      where: {
        id: { in: topIds },
        ...(Object.keys(enrichmentFilter).length > 0 ? { enrichment: enrichmentFilter } : {}),
      },
      include: {
        source: {
          select: { name: true },
        },
        enrichment: {
          select: {
            titleTh: true,
            summaryTh: true,
            tags: true,
            sentiment: true,
            marketImpact: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });

    // Map to response format
    const items = articles.map((article) => ({
      id: article.id,
      url: article.url,
      titleOriginal: article.titleOriginal,
      titleTh: article.enrichment?.titleTh,
      summaryTh: article.enrichment?.summaryTh,
      publishedAt: article.publishedAt,
      source: article.source.name,
      tags: article.enrichment?.tags || [],
      sentiment: article.enrichment?.sentiment.toLowerCase(),
      marketImpact: article.enrichment?.marketImpact.toLowerCase(),
    }));

    return NextResponse.json(
      { items, total: items.length, query },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=${CACHE_DURATION * 2}`,
        },
      }
    );
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
