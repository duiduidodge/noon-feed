import { NewsFeed } from '@/components/news-feed';
import { BiDailySummary } from '@/components/bi-daily-summary';
import { PricesColumn } from '@/components/prices-column';
import { PanelShell } from '@/components/panel-shell';
import { MarketChatterPanel } from '@/components/market-chatter-panel';
import { SignalPulseStrip } from '@/components/signal-pulse-strip';
import { TradeSetupsPanel } from '@/components/trade-setups-panel';
import type { FeedArticle } from '@/components/news-card';

interface FeedHomeProps {
  initialArticles: FeedArticle[];
}

export function FeedHome({ initialArticles }: FeedHomeProps) {
  return (
    <div className="min-h-[100dvh] lg:h-[100dvh] lg:overflow-hidden bg-background">
      <main className="mx-auto flex h-full w-full max-w-[1640px] flex-col px-3 pb-2 pt-2 md:px-unit-4 md:pb-3 lg:px-unit-4">
        <div className="flex flex-col gap-unit-3 lg:grid lg:h-[calc(100dvh-112px)] lg:grid-cols-[448px_minmax(0,1fr)_192px] lg:gap-unit-3">
          <div id="section-markets" role="region" aria-label="Market data and signals" className="order-2 lg:order-none flex flex-col lg:min-h-0">
            <PanelShell variant="secondary" className="flex-1 flex flex-col">
              <div className="flex-1 px-unit-3 pb-unit-3 pt-unit-2">
                <PricesColumn />
              </div>
            </PanelShell>
          </div>

          <div role="region" aria-label="News feed and briefing" className="order-1 lg:order-none flex flex-col gap-unit-2 lg:overflow-hidden">
            <PanelShell id="section-briefing" className="order-2 lg:order-1 shrink-0 bg-transparent border-0 p-0 shadow-none overflow-visible !bg-none">
              <BiDailySummary />
            </PanelShell>

            <PanelShell id="section-latest-intel" variant="primary" className="order-1 lg:order-2 flex-1 min-h-0 overflow-hidden relative">
              <NewsFeed initialArticles={initialArticles} />
            </PanelShell>
          </div>

          <div id="section-posts" role="region" aria-label="Market chatter and setups" className="order-3 lg:order-none flex flex-col gap-unit-3 lg:overflow-hidden">
            <div className="shrink-0">
              <SignalPulseStrip />
            </div>
            <div className="shrink-0 lg:max-h-[246px] overflow-hidden">
              <PanelShell variant="secondary" className="overflow-hidden">
                <TradeSetupsPanel />
              </PanelShell>
            </div>
            <div className="flex-1 min-h-[260px] overflow-hidden">
              <MarketChatterPanel className="h-full" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
