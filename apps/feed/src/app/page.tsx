import { FeedHeader } from '@/components/feed-header';
import { NewsFeed } from '@/components/news-feed';
import { PricesColumn } from '@/components/prices-column';
import { BiDailySummary } from '@/components/bi-daily-summary';
import { MyPostsWidget } from '@/components/my-posts-widget';
import type { FeedArticle } from '@/components/news-card';

export const dynamic = 'force-dynamic';

async function getInitialArticles(): Promise<FeedArticle[]> {
  try {
    const { prisma } = await import('@/lib/prisma');
    const articles = await prisma.article.findMany({
      where: {
        status: { in: ['FETCHED', 'ENRICHED'] },
        enrichment: {
          marketImpact: { in: ['MEDIUM', 'HIGH'] },
        },
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

export default async function FeedPage() {
  const initialArticles = await getInitialArticles();

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-[1780px] flex-1 flex-col px-4 pb-4 lg:px-5">
        <div className="grid min-h-0 grid-cols-1 gap-2.5 md:grid-cols-2 lg:h-[calc(100vh-94px)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)_minmax(260px,0.65fr)] xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)_minmax(260px,0.65fr)_minmax(220px,0.5fr)] xl:gap-3 lg:mt-2">
          {/* Col 1: Latest Intel — news feed */}
          <section id="section-latest-intel" className="min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-sm column-panel">
            <NewsFeed initialArticles={initialArticles} />
          </section>

          {/* Col 2: Morning/Evening Briefing */}
          <section id="section-briefing" className="min-h-0 overflow-y-auto rounded-2xl border border-border/60 bg-card/50 custom-scrollbar shadow-sm column-panel">
            <BiDailySummary />
          </section>

          {/* Col 3: My Posts */}
          <aside id="section-posts" className="min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-sm column-panel">
            <MyPostsWidget />
          </aside>

          {/* Col 4: Market Mood */}
          <aside id="section-markets" className="min-h-0 overflow-y-auto rounded-2xl border border-border/60 bg-card/50 p-3 custom-scrollbar shadow-sm column-panel">
            <PricesColumn />
          </aside>
        </div>
      </main>
    </div>
  );
}
