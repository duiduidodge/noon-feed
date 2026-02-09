'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface Headline {
  title: string;
  url: string;
  source: string;
}

interface PriceData {
  btc: { price: number; change24h: number };
  eth: { price: number; change24h: number };
  sol: { price: number; change24h: number };
  hype: { price: number; change24h: number };
  totalMarketCap: number;
  marketCapChange24h: number;
  fearGreedIndex: number;
  fearGreedLabel: string;
}

interface Summary {
  id: string;
  scheduleType: 'morning' | 'evening';
  summaryText: string;
  headlines: Headline[];
  prices: PriceData;
  articleCount: number;
  createdAt: string;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  return `$${(value / 1e6).toFixed(0)}M`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = date.getDate();
  const month = date.toLocaleDateString('th-TH', { month: 'short' });
  return `${day} ${month}`;
}

const COIN_LOGOS: Record<string, string> = {
  BTC: 'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png',
  ETH: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
  SOL: 'https://coin-images.coingecko.com/coins/images/4128/large/solana.png',
};

function PriceIndicator({ coin, price, change }: { coin: string; price: number; change: number }) {
  const isPositive = change >= 0;
  const coinLogo = COIN_LOGOS[coin];

  return (
    <div className="group relative">
      <div className="flex items-baseline gap-2">
        {coinLogo ? (
          <span className="inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full border border-border/30 bg-surface/50">
            <Image src={coinLogo} alt={coin} width={16} height={16} className="h-4 w-4" />
          </span>
        ) : (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/30 bg-surface/50 font-mono-data text-[9px] text-muted-foreground">
            H
          </span>
        )}
        <span className="font-mono text-sm font-medium text-foreground">{formatPrice(price)}</span>
        <span className={`font-mono text-xs font-semibold ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
          {formatChange(change)}
        </span>
      </div>
      <div className={`absolute -left-1 top-0 bottom-0 w-0.5 rounded-full transition-all duration-300 ${
        isPositive ? 'bg-bullish/30 group-hover:bg-bullish/60' : 'bg-bearish/30 group-hover:bg-bearish/60'
      }`} />
    </div>
  );
}

function SummaryCard({ summary }: { summary: Summary }) {
  const isMorning = summary.scheduleType === 'morning';
  const timeEmoji = isMorning ? '🌅' : '🌆';
  const summaryLabel = isMorning ? 'Morning Market Summary' : 'Evening Market Summary';

  const { prices } = summary;
  const fgEmoji =
    prices.fearGreedIndex <= 25 ? '🔴' :
    prices.fearGreedIndex <= 45 ? '🟠' :
    prices.fearGreedIndex <= 55 ? '🟡' : '🟢';

  return (
    <div className="summary-card group relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-card/90 via-card/70 to-surface/80 backdrop-blur-xl transition-all duration-500 hover:border-accent/30 hover:shadow-2xl hover:shadow-accent/5">
      {/* Decorative corner accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="relative p-4">
        {/* Header */}
        <div className="mb-6 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-accent/40 to-transparent" />
              <span className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-accent/80">
                {summaryLabel}
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-accent/40 to-transparent" />
            </div>
            <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/40 bg-surface/60 px-2.5 py-1 backdrop-blur-sm">
              <span className="text-sm leading-none">{timeEmoji}</span>
              <span className="font-mono-data text-[11px] text-muted-foreground tracking-wide">
                {formatTime(summary.createdAt)}
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-display text-sm text-muted-foreground tracking-tight">
              {formatDate(summary.createdAt)}
            </h3>
            <span className="font-mono-data text-xs text-muted-foreground/60">
              {summary.articleCount} ข่าว
            </span>
          </div>
        </div>

        {/* Summary text - Editorial style */}
        <div className="mb-8 prose prose-invert max-w-none">
          <p className="font-thai text-base leading-relaxed text-foreground/95 whitespace-pre-line">
            {summary.summaryText}
          </p>
        </div>

        {/* Market data grid */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Coin prices */}
          <div className="space-y-3 p-4 rounded-lg bg-surface/40 border border-border/30">
            <h4 className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
              ราคาเหรียญ
            </h4>
            <PriceIndicator coin="BTC" price={prices.btc.price} change={prices.btc.change24h} />
            <PriceIndicator coin="ETH" price={prices.eth.price} change={prices.eth.change24h} />
            <PriceIndicator coin="SOL" price={prices.sol.price} change={prices.sol.change24h} />
            <PriceIndicator coin="HYPE" price={prices.hype.price} change={prices.hype.change24h} />
          </div>

          {/* Right: Market metrics */}
          <div className="space-y-4 p-4 rounded-lg bg-surface/40 border border-border/30">
            <h4 className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
              ตลาดโดยรวม
            </h4>

            {/* Market cap */}
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xs text-muted-foreground">Market Cap</span>
                <span className={`font-mono text-xs font-semibold ${
                  prices.marketCapChange24h >= 0 ? 'text-bullish' : 'text-bearish'
                }`}>
                  {formatChange(prices.marketCapChange24h)}
                </span>
              </div>
              <div className="font-mono text-lg font-bold text-foreground">
                {formatMarketCap(prices.totalMarketCap)}
              </div>
            </div>

            {/* Fear & Greed */}
            <div className="space-y-2 pt-2 border-t border-border/30">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xs text-muted-foreground">Fear & Greed</span>
                <span className="text-sm">{fgEmoji}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-foreground">{prices.fearGreedIndex}</span>
                <span className="font-mono text-xs text-muted-foreground">{prices.fearGreedLabel}</span>
              </div>
              {/* Visual bar */}
              <div className="h-1.5 rounded-full bg-surface/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-bearish via-yellow-500 to-bullish animate-[expand-width_1s_ease-out_both]"
                  style={{
                    width: `${prices.fearGreedIndex}%`,
                    animationDelay: '200ms'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Headlines - Magazine column layout */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-border/40 to-transparent" />
            <h4 className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              ข่าวเด่น
            </h4>
            <div className="h-px flex-1 bg-gradient-to-l from-border/40 to-transparent" />
          </div>

          <div className="space-y-2">
            {summary.headlines.slice(0, 6).map((headline, idx) => (
              <a
                key={idx}
                href={headline.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/link flex items-start gap-2 py-2 px-3 rounded-md hover:bg-surface/40 transition-all duration-200"
              >
                <span className="font-mono-data text-[10px] text-accent/50 mt-1 flex-shrink-0 group-hover/link:text-accent transition-colors">
                  {(idx + 1).toString().padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="font-thai text-sm text-foreground/90 group-hover/link:text-accent transition-colors line-clamp-2">
                    {headline.title}
                  </p>
                  <span className="font-mono-data text-[10px] text-muted-foreground/60">
                    {headline.source}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-accent/30 to-transparent group-hover:via-accent/60 transition-all duration-700" />
    </div>
  );
}

export function BiDailySummary() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSummaries() {
      try {
        const res = await fetch('/api/summaries');
        if (res.ok) {
          const data = await res.json();
          // Only show latest 2 summaries
          setSummaries(data.slice(0, 2));
        }
      } catch (error) {
        console.error('Failed to fetch summaries:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSummaries();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1].map((i) => (
          <div key={i} className="h-[400px] rounded-xl bg-card/50 animate-shimmer border border-border/30" />
        ))}
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="p-8 text-center rounded-xl border border-dashed border-border/40 bg-surface/20">
        <p className="font-thai text-sm text-muted-foreground">
          ยังไม่มีสรุปตลาด
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summaries.map((summary) => (
        <SummaryCard key={summary.id} summary={summary} />
      ))}
    </div>
  );
}
