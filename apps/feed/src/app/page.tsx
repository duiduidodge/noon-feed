import { NewsFeed } from '@/components/news-feed';
import { BiDailySummary } from '@/components/bi-daily-summary';
import { PricesColumn } from '@/components/prices-column';
import { PanelShell } from '@/components/panel-shell';
import { MarketChatterPanel } from '@/components/market-chatter-panel';
import { SignalPulseStrip } from '@/components/signal-pulse-strip';
import { TradeSetupsPanel } from '@/components/trade-setups-panel';
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
    <div className="min-h-[100dvh] lg:h-[100dvh] lg:overflow-hidden bg-background">
      <main className="mx-auto flex h-full w-full max-w-[1640px] flex-col px-3 pb-unit-3 pt-unit-2 md:px-unit-4 md:pb-unit-4 lg:px-unit-4">

        {/* 3-Column Layout */}
        <div className="flex flex-col gap-unit-3 lg:grid lg:h-[calc(100dvh-86px)] lg:grid-cols-[280px_1fr_280px] lg:gap-unit-4">

          {/* LEFT COLUMN: Signals Strip + Market Data */}
          <div id="section-markets" role="region" aria-label="Market data and signals" className="order-2 lg:order-none flex flex-col gap-unit-3 lg:overflow-hidden">
            <div className="shrink-0">
              <SignalPulseStrip />
            </div>
            <div className="shrink-0">
              <TradeSetupsPanel />
            </div>
            <PanelShell variant="secondary" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-unit-3">
                <PricesColumn />
              </div>
            </PanelShell>
          </div>

          {/* CENTER COLUMN: Main Feed */}
          <div role="region" aria-label="News feed and briefing" className="order-1 lg:order-none flex flex-col gap-unit-3 lg:overflow-hidden">

            {/* Briefing (Compact) */}
            <PanelShell id="section-briefing" className="order-2 lg:order-1 shrink-0 bg-transparent border-0 p-0 shadow-none overflow-visible !bg-none">
              <BiDailySummary />
            </PanelShell>

            {/* News Feed */}
            <PanelShell id="section-latest-intel" variant="primary" className="order-1 lg:order-2 flex-1 min-h-0 overflow-hidden relative">
              <NewsFeed initialArticles={initialArticles} />
            </PanelShell>
          </div>

          {/* RIGHT COLUMN: Chatter */}
          <div id="section-posts" role="region" aria-label="Market chatter" className="order-3 lg:order-none flex flex-col gap-unit-3 lg:overflow-hidden">
            <div className="flex-1 min-h-[300px] overflow-hidden">
              <MarketChatterPanel className="h-full" />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
