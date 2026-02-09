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

    return articles.map((article) => ({
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
      <main className="mx-auto max-w-[1800px] px-4">
        {/* 4-column layout (desktop): News | Summary | My Posts | Prices */}
        <div className="grid h-[calc(100vh-60px)] min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px_340px_300px]">
          {/* Left: News Feed */}
          <div className="glass flex min-h-0 flex-col overflow-hidden rounded-lg max-h-[calc(100vh-76px)] lg:max-h-[calc(100vh-76px)]">
            <NewsFeed initialArticles={initialArticles} />
          </div>

          {/* Summary */}
          <div className="min-h-0 overflow-y-auto custom-scrollbar max-h-[calc(100vh-76px)]">
            <BiDailySummary />
          </div>

          {/* My Posts */}
          <div className="min-h-0 overflow-y-auto custom-scrollbar max-h-[calc(100vh-76px)]">
            <MyPostsWidget />
          </div>

          {/* Right: Prices */}
          <div className="glass min-h-0 overflow-y-auto rounded-lg p-4 custom-scrollbar max-h-[calc(100vh-76px)]">
            <PricesColumn />
          </div>
        </div>
      </main>
    </div>
  );
}
