'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { clsx } from 'clsx';

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

function formatDateRich(isoString: string): string {
  const date = new Date(isoString);
  const day = date.getDate();
  const monthTh = date.toLocaleDateString('th-TH', { month: 'short' });
  const weekdayTh = date.toLocaleDateString('th-TH', { weekday: 'short' });
  return `${weekdayTh}, ${day} ${monthTh}`;
}

const COIN_LOGOS: Record<string, string> = {
  BTC: 'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png',
  ETH: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
  SOL: 'https://coin-images.coingecko.com/coins/images/4128/large/solana.png',
};

// Mini price chip for the top strip
function PriceChip({ coin, price: _price, change }: { coin: string; price: number; change: number }) {
  const isPositive = change >= 0;
  const coinLogo = COIN_LOGOS[coin];

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-surface/40 px-2.5 py-1 transition-colors hover:bg-surface/70">
      {coinLogo ? (
        <Image src={coinLogo} alt={coin} width={14} height={14} className="h-3.5 w-3.5 rounded-full" />
      ) : (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface font-mono-data text-[7px] text-muted-foreground">
          {coin[0]}
        </span>
      )}
      <span className="font-mono-data text-[11px] font-semibold text-foreground">
        {coin}
      </span>
      <span className={clsx(
        'font-mono-data text-[10px] font-semibold',
        isPositive ? 'text-bullish' : 'text-bearish'
      )}>
        {formatChange(change)}
      </span>
    </div>
  );
}

function PriceIndicator({ coin, price, change }: { coin: string; price: number; change: number }) {
  const isPositive = change >= 0;
  const coinLogo = COIN_LOGOS[coin];

  return (
    <div className="group relative">
      <div className="flex items-baseline gap-2">
        {coinLogo ? (
          <span className="inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-surface/50">
            <Image src={coinLogo} alt={coin} width={16} height={16} className="h-4 w-4" />
          </span>
        ) : (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/40 bg-surface/50 font-mono-data text-[9px] text-muted-foreground">
            H
          </span>
        )}
        <span className="font-mono-data text-sm font-medium text-foreground">{formatPrice(price)}</span>
        <span className={`font-mono-data text-xs font-semibold ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
          {formatChange(change)}
        </span>
      </div>
      <div className={`absolute -left-1 top-0 bottom-0 w-0.5 rounded-full transition-all duration-300 ${isPositive ? 'bg-bullish/25 group-hover:bg-bullish/50' : 'bg-bearish/25 group-hover:bg-bearish/50'
        }`} />
    </div>
  );
}

// Redesigned coin card for 2x2 grid in summary section
function CoinPriceCard({ coin, price, change }: { coin: string; price: number; change: number }) {
  const isPositive = change >= 0;
  const coinLogos: Record<string, string> = {
    BTC: '/tokens/btc.png',
    ETH: '/tokens/eth.png',
    SOL: '/tokens/sol.png',
    HYPE: '/tokens/hype.png',
  };
  const coinLogo = coinLogos[coin];

  return (
    <div className={clsx(
      'relative rounded-lg border border-border/30 bg-card/40 p-3 flex flex-col items-center gap-1.5 transition-all duration-200 hover:bg-card/70 hover:border-border/60',
      'overflow-hidden'
    )}>
      {/* Top accent gradient */}
      <div className={clsx(
        'absolute inset-x-0 top-0 h-0.5',
        isPositive ? 'bg-gradient-to-r from-transparent via-bullish/60 to-transparent' : 'bg-gradient-to-r from-transparent via-bearish/60 to-transparent'
      )} />

      {/* Logo + Symbol */}
      <div className="flex items-center gap-1.5">
        {coinLogo ? (
          <Image src={coinLogo} alt={coin} width={20} height={20} className="h-5 w-5 rounded-full" />
        ) : (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface/50 font-mono-data text-[9px] text-muted-foreground border border-border/40">
            {coin[0]}
          </span>
        )}
        <span className="font-mono-data text-[10px] font-bold uppercase text-muted-foreground tracking-wider">{coin}</span>
      </div>

      {/* Price */}
      <span className="font-mono-data text-sm font-bold text-foreground leading-none">
        {formatPrice(price)}
      </span>

      {/* Change */}
      <span className={clsx(
        'font-mono-data text-[11px] font-semibold leading-none',
        isPositive ? 'text-bullish' : 'text-bearish'
      )}>
        {formatChange(change)}
      </span>
    </div>
  );
}

// Split summary text into paragraphs and highlight inline numbers
function FormattedSummary({ text }: { text: string }) {
  // Split on double newlines or single newlines with enough length
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());

  return (
    <div className="space-y-4">
      {paragraphs.map((para, idx) => (
        <p key={idx} className="font-thai text-[15px] leading-[1.85] text-foreground/85">
          {highlightNumbers(para)}
        </p>
      ))}
    </div>
  );
}

// Highlight percentages and dollar amounts inline
function highlightNumbers(text: string) {
  const parts = text.split(/([-+]?\d+\.?\d*%|\$[\d,.]+[TBMK]?)/g);
  return parts.map((part, i) => {
    if (/^[-+]?\d+\.?\d*%$/.test(part)) {
      const isPositive = !part.startsWith('-');
      return (
        <span key={i} className={clsx(
          'font-mono-data text-[13px] font-semibold px-0.5 rounded',
          isPositive ? 'text-bullish' : 'text-bearish'
        )}>
          {part}
        </span>
      );
    }
    if (/^\$[\d,.]+[TBMK]?$/.test(part)) {
      return (
        <span key={i} className="font-mono-data text-[13px] font-semibold text-foreground px-0.5">
          {part}
        </span>
      );
    }
    return part;
  });
}

function SummaryCard({ summary }: { summary: Summary }) {
  const isMorning = summary.scheduleType === 'morning';
  const timeEmoji = isMorning ? '🌅' : '🌆';
  const briefingLabel = isMorning ? 'MORNING\nBRIEFING' : 'EVENING\nBRIEFING';

  // Fetch LIVE Fear & Greed from the same source as Market Mood sidebar
  const { data: liveMarket } = useQuery({
    queryKey: ['market-overview'],
    queryFn: async () => {
      const res = await fetch('/api/market-overview');
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{ fearGreedIndex: number; fearGreedLabel: string }>;
    },
    refetchInterval: 60_000,
  });

  const { prices } = summary;
  // Use live F&G (same as Market Mood), fallback to stored snapshot
  const liveFG = liveMarket?.fearGreedIndex ?? prices.fearGreedIndex;
  const liveFGLabel = liveMarket?.fearGreedLabel ?? prices.fearGreedLabel;
  const fgEmoji =
    liveFG <= 25 ? '🔴' :
      liveFG <= 45 ? '🟠' :
        liveFG <= 55 ? '🟡' : '🟢';

  return (
    <div className="summary-card group relative overflow-hidden transition-all duration-500">
      <div className="relative p-5">
        {/* Large editorial header */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-display text-3xl font-extrabold leading-none tracking-tight text-foreground whitespace-pre-line uppercase">
              {briefingLabel}
            </h3>
            <div className="shrink-0 text-right space-y-0.5">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-surface/50 px-2.5 py-1">
                <span className="text-sm leading-none">{timeEmoji}</span>
                <span className="font-mono-data text-[11px] text-muted-foreground tracking-wide">
                  {formatTime(summary.createdAt)}
                </span>
              </div>
              <div className="font-mono-data text-[10px] text-muted-foreground/60 pr-1">
                {summary.articleCount} ข่าว
              </div>
            </div>
          </div>
          <div className="mt-1.5 font-display text-sm text-muted-foreground tracking-tight">
            {formatDateRich(summary.createdAt)}
          </div>
        </div>

        {/* Price strip — quick glance at key prices */}
        <div className="mb-5 flex flex-wrap gap-2">
          <PriceChip coin="BTC" price={prices.btc.price} change={prices.btc.change24h} />
          <PriceChip coin="ETH" price={prices.eth.price} change={prices.eth.change24h} />
          <PriceChip coin="SOL" price={prices.sol.price} change={prices.sol.change24h} />
          <div className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-surface/40 px-2.5 py-1">
            <span className="text-xs leading-none">{fgEmoji}</span>
            <span className="font-mono-data text-[10px] text-muted-foreground">F&G</span>
            <span className="font-mono-data text-[11px] font-bold text-foreground">{liveFG}</span>
          </div>
        </div>

        {/* Summary text — improved typography with paragraph breaks and inline highlights */}
        <div className="mb-8">
          <FormattedSummary text={summary.summaryText} />
        </div>

        {/* Market data grid */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Coin prices — redesigned as a 2x2 grid */}
          <div className="p-4 rounded-xl bg-surface/50 border border-border/40">
            <h4 className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
              ราคาเหรียญ
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <CoinPriceCard coin="BTC" price={prices.btc.price} change={prices.btc.change24h} />
              <CoinPriceCard coin="ETH" price={prices.eth.price} change={prices.eth.change24h} />
              <CoinPriceCard coin="SOL" price={prices.sol.price} change={prices.sol.change24h} />
              <CoinPriceCard coin="HYPE" price={prices.hype.price} change={prices.hype.change24h} />
            </div>
          </div>

          {/* Right: Market metrics */}
          <div className="space-y-4 p-4 rounded-xl bg-surface/50 border border-border/40">
            <h4 className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
              ตลาดโดยรวม
            </h4>

            {/* Market cap */}
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="font-mono-data text-xs text-muted-foreground">Market Cap</span>
                <span className={`font-mono-data text-xs font-semibold ${prices.marketCapChange24h >= 0 ? 'text-bullish' : 'text-bearish'
                  }`}>
                  {formatChange(prices.marketCapChange24h)}
                </span>
              </div>
              <div className="font-mono-data text-lg font-bold text-foreground">
                {formatMarketCap(prices.totalMarketCap)}
              </div>
            </div>

            {/* Fear & Greed — uses live data matching Market Mood */}
            <div className="space-y-2 pt-2 border-t border-border/30">
              <div className="flex items-baseline justify-between">
                <span className="font-mono-data text-xs text-muted-foreground">Fear & Greed</span>
                <span className="text-sm">{fgEmoji}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono-data text-2xl font-bold text-foreground">{liveFG}</span>
                <span className="font-mono-data text-xs text-muted-foreground">{liveFGLabel}</span>
              </div>
              {/* Visual bar */}
              <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-bearish via-yellow-500 to-bullish animate-[expand-width_1s_ease-out_both]"
                  style={{
                    width: `${liveFG}%`,
                    animationDelay: '200ms'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Headlines */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
            <h4 className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              ข่าวเด่น
            </h4>
            <div className="h-px flex-1 bg-gradient-to-l from-border/50 to-transparent" />
          </div>

          <div className="space-y-1">
            {summary.headlines.slice(0, 6).map((headline, idx) => (
              <a
                key={idx}
                href={headline.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/link flex items-start gap-2 py-2 px-3 rounded-lg hover:bg-surface/50 transition-all duration-200"
              >
                <span className="font-mono-data text-[10px] text-primary/40 mt-1 flex-shrink-0 group-hover/link:text-primary transition-colors">
                  {(idx + 1).toString().padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="font-thai text-sm text-foreground/90 group-hover/link:text-primary transition-colors line-clamp-2">
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
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent group-hover:via-primary/40 transition-all duration-700" />
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
      <div className="space-y-4 p-5">
        {[1].map((i) => (
          <div key={i} className="h-[400px] rounded-xl bg-surface/40 animate-shimmer border border-border/30" />
        ))}
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="p-8 text-center rounded-xl border border-dashed border-border/50 bg-surface/20 m-5">
        <p className="font-thai text-sm text-muted-foreground">
          ยังไม่มีสรุปตลาด
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {summaries.map((summary) => (
        <SummaryCard key={summary.id} summary={summary} />
      ))}
    </div>
  );
}
