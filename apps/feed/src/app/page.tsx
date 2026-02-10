import { FeedHeader } from '@/components/feed-header';
import { NewsFeed } from '@/components/news-feed';
import { PricesColumn } from '@/components/prices-column';
import { MyPostsWidget } from '@/components/my-posts-widget';
import { BiDailySummary } from '@/components/bi-daily-summary';
import type { FeedArticle } from '@/components/news-card';

export const dynamic = 'force-dynamic';

async function getInitialArticles(): Promise<FeedArticle[]> {
  try {
    const { prisma } = await import('@/lib/prisma');
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

export default async function FeedPage() {
  const initialArticles = await getInitialArticles();

  return (
    <div className="min-h-screen">
      <FeedHeader />
      <main className="mx-auto max-w-[1780px] px-4 pb-4 pt-3 lg:px-5">
        <div className="grid min-h-0 grid-cols-1 gap-3 lg:h-[calc(100vh-76px)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(280px,0.46fr)] xl:grid-cols-[minmax(0,0.96fr)_minmax(0,0.76fr)_minmax(0,0.62fr)_minmax(280px,0.44fr)] xl:gap-3.5">
          <section className="glass panel-shell min-h-0 overflow-hidden rounded-2xl">
            <NewsFeed initialArticles={initialArticles} />
          </section>

          <section className="glass panel-shell min-h-0 overflow-y-auto rounded-2xl custom-scrollbar">
            <BiDailySummary />
          </section>

          <section className="glass panel-shell min-h-0 overflow-hidden rounded-2xl">
            <MyPostsWidget />
          </section>

          <aside className="glass panel-shell min-h-0 overflow-y-auto rounded-2xl p-3.5 custom-scrollbar">
            <PricesColumn />
          </aside>
        </div>
      </main>
    </div>
  );
}
