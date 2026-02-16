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
  HYPE: 'https://coin-images.coingecko.com/coins/images/50882/large/hyperliquid.jpg',
};

// Mini price chip for the top strip
function PriceChip({ coin, price, change }: { coin: string; price: number; change: number }) {
  const isPositive = change >= 0;
  const coinLogo = COIN_LOGOS[coin];

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-surface/40 px-2 py-1 transition-all hover:bg-surface/60 hover:border-border/60 group cursor-default">
      {coinLogo ? (
        <Image src={coinLogo} alt={coin} width={14} height={14} className="h-3.5 w-3.5 rounded-full grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
      ) : (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface font-mono-data text-[7px] text-muted-foreground border border-border/50">
          {coin[0]}
        </span>
      )}
      <span className="font-mono-data text-[10px] font-semibold text-foreground">
        {coin}
      </span>
      <span className={clsx(
        'font-mono-data text-[9px] font-semibold tabular-nums',
        isPositive ? 'text-bullish' : 'text-bearish'
      )}>
        {formatChange(change)}
      </span>
    </div>
  );
}

// Mini gauge for inline Fear & Greed display
function MiniMoodGauge({ value, label, compact }: { value: number; label: string; compact?: boolean }) {
  const valueColor =
    value <= 25 ? 'text-bearish' :
      value <= 45 ? 'text-orange-500' :
        value <= 55 ? 'text-yellow-600' : 'text-bullish';

  if (compact) {
    // ── Compact: inline pill ──
    const r = 16;
    const cx = 20;
    const cy = 18;
    const nx = cx + (r - 2) * Math.cos((180 - (value / 100) * 180) * (Math.PI / 180));
    const ny = cy - (r - 2) * Math.sin((180 - (value / 100) * 180) * (Math.PI / 180));

    return (
      <div className="inline-flex items-center gap-1.5">
        <svg viewBox="0 0 40 20" className="w-[24px] h-[12px] shrink-0">
          <defs>
            <linearGradient id="compactFgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(0, 50%, 48%)" />
              <stop offset="25%" stopColor="hsl(25, 70%, 50%)" />
              <stop offset="50%" stopColor="hsl(45, 70%, 50%)" />
              <stop offset="75%" stopColor="hsl(90, 40%, 45%)" />
              <stop offset="100%" stopColor="hsl(145, 55%, 38%)" />
            </linearGradient>
          </defs>
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="url(#compactFgGrad)" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="url(#compactFgGrad)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(value / 100) * Math.PI * r} ${Math.PI * r}`} />
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="1.5" fill="currentColor" />
        </svg>
        <div className="flex flex-col leading-none">
          <span className={clsx('font-mono-data text-[10px] font-bold', valueColor)}>{value}</span>
        </div>
      </div>
    );
  }

  // ── Normal: centered gauge ──
  const r = 36;
  const cx = 44;
  const cy = 40;
  const nx = cx + (r - 5) * Math.cos((180 - (value / 100) * 180) * (Math.PI / 180));
  const ny = cy - (r - 5) * Math.sin((180 - (value / 100) * 180) * (Math.PI / 180));

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 88 46" className="w-[80px]">
        <defs>
          <linearGradient id="normalFgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(0, 50%, 48%)" />
            <stop offset="25%" stopColor="hsl(25, 70%, 50%)" />
            <stop offset="50%" stopColor="hsl(45, 70%, 50%)" />
            <stop offset="75%" stopColor="hsl(90, 40%, 45%)" />
            <stop offset="100%" stopColor="hsl(145, 55%, 38%)" />
          </linearGradient>
        </defs>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="url(#normalFgGrad)" strokeWidth="5" strokeLinecap="round" opacity="0.15" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="url(#normalFgGrad)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(value / 100) * Math.PI * r} ${Math.PI * r}`} />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="2.5" fill="currentColor" />
        <text x={cx} y={cy - 12} textAnchor="middle" className={clsx('font-mono-data font-bold', valueColor)} style={{ fontSize: '18px', fill: 'currentColor' }}>{value}</text>
      </svg>
      <span className={clsx('font-mono-data text-[9px] font-bold uppercase tracking-widest', valueColor)}>{label}</span>
    </div>
  );
}

// Redesigned coin card for 2x2 grid in summary section
function CoinGridCard({ coin, price, change }: { coin: string; price: number; change: number }) {
  const isPositive = change >= 0;
  const coinLogos: Record<string, string> = {
    BTC: 'https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png',
    ETH: 'https://coin-images.coingecko.com/coins/images/279/small/ethereum.png',
    SOL: 'https://coin-images.coingecko.com/coins/images/4128/small/solana.png',
    HYPE: 'https://coin-images.coingecko.com/coins/images/50882/small/hyperliquid.jpg',
  };
  const coinLogo = coinLogos[coin];

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/30 bg-surface/40 p-2.5 flex flex-col items-center gap-1 transition-all duration-200 hover:bg-surface/60 hover:border-border/50">
      {/* Top accent gradient */}
      <div className={clsx(
        'absolute inset-x-0 top-0 h-[2px] opacity-60 transition-opacity group-hover:opacity-100',
        isPositive ? 'bg-bullish' : 'bg-bearish'
      )} />

      {/* Header */}
      <div className="flex items-center gap-1.5 w-full justify-between">
        <div className="flex items-center gap-1.5">
          {coinLogo ? (
            <Image src={coinLogo} alt={coin} width={16} height={16} className="h-4 w-4 rounded-full grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
          ) : (
            <div className="h-4 w-4 rounded-full bg-muted" />
          )}
          <span className="font-mono-data text-[10px] font-bold text-muted-foreground">{coin}</span>
        </div>
        <span className={clsx('font-mono-data text-[9px] font-semibold', isPositive ? 'text-bullish' : 'text-bearish')}>
          {formatChange(change)}
        </span>
      </div>

      {/* Price */}
      <div className="flex-1 flex items-end">
        <span className="font-mono-data text-xs font-bold text-foreground">
          {formatPrice(price)}
        </span>
      </div>
    </div>
  );
}

// Split summary text into paragraphs and highlight inline numbers
function FormattedSummary({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());

  return (
    <div className="space-y-4">
      {paragraphs.map((para, idx) => (
        <p key={idx} className="font-thai text-[15px] leading-relaxed text-foreground/90 tracking-wide">
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
          'font-mono-data text-[13px] font-semibold px-0.5 rounded transition-colors',
          isPositive ? 'text-bullish bg-bullish/5' : 'text-bearish bg-bearish/5'
        )}>
          {part}
        </span>
      );
    }
    if (/^\$[\d,.]+[TBMK]?$/.test(part)) {
      return (
        <span key={i} className="font-mono-data text-[13px] font-medium text-foreground px-0.5">
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
  const accentGradient = isMorning
    ? 'from-orange-500/10 via-amber-500/5 to-transparent'
    : 'from-blue-500/10 via-indigo-500/5 to-transparent';

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
  const liveFG = liveMarket?.fearGreedIndex ?? prices.fearGreedIndex;
  const liveFGLabel = liveMarket?.fearGreedLabel ?? prices.fearGreedLabel;

  return (
    <div className="group relative overflow-hidden transition-all duration-500 hover:bg-surface/20">
      {/* Editorial Accent Background */}
      <div className={`absolute top-0 right-0 w-[60%] h-[300px] bg-gradient-to-bl ${accentGradient} opacity-50 blur-3xl pointer-events-none`} />

      <div className="relative p-6 px-7">
        {/* Editorial Header */}
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/50 backdrop-blur-md px-2.5 py-0.5 mb-2 shadow-sm">
                <span className="text-xs">{timeEmoji}</span>
                <span className="font-mono-data text-[10px] font-bold tracking-wider text-foreground/80 uppercase">
                  {isMorning ? 'Daily Intel' : 'Market Wrap'}
                </span>
                <div className="h-2.5 w-px bg-border/50 mx-0.5" />
                <span className="font-mono-data text-[10px] text-muted-foreground mr-1">
                  {formatTime(summary.createdAt)}
                </span>
              </div>
              <h3 className="font-display text-4xl font-extrabold leading-[0.9] tracking-tight text-foreground uppercase drop-shadow-sm">
                {briefingLabel}
              </h3>
              <p className="font-display text-sm font-medium text-muted-foreground/80 tracking-wide mt-1">
                {formatDateRich(summary.createdAt)}
              </p>
            </div>

            {/* Quick Stats Grid - Compact */}
            <div className="hidden sm:grid grid-cols-2 gap-2 bg-surface/30 p-2 rounded-xl backdrop-blur-sm border border-border/30">
              <div className="flex flex-col items-center justify-center px-3 py-1 bg-background/40 rounded-lg">
                <span className="font-mono-data text-[9px] text-muted-foreground uppercase">Articles</span>
                <span className="font-mono-data text-xs font-bold">{summary.articleCount}</span>
              </div>
              <div className="flex flex-col items-center justify-center px-3 py-1 bg-background/40 rounded-lg">
                <span className="font-mono-data text-[9px] text-muted-foreground uppercase">Sent</span>
                <span className="font-mono-data text-xs font-bold text-bullish">Bullish</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Strip */}
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <PriceChip coin="BTC" price={prices.btc.price} change={prices.btc.change24h} />
          <PriceChip coin="ETH" price={prices.eth.price} change={prices.eth.change24h} />
          <PriceChip coin="SOL" price={prices.sol.price} change={prices.sol.change24h} />
        </div>

        {/* Content Body */}
        <div className="mb-10 relative">
          <div className="absolute -left-4 top-1 bottom-1 w-0.5 bg-gradient-to-b from-primary/40 via-primary/10 to-transparent" />
          <FormattedSummary text={summary.summaryText} />
        </div>

        {/* Market Data Dashboard */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-4">
          {/* Dashboard Left: Coins */}
          <div className="p-4 rounded-xl bg-surface/30 border border-border/30 backdrop-blur-sm">
            <h4 className="font-mono-data text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
              Key Movers
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <CoinGridCard coin="BTC" price={prices.btc.price} change={prices.btc.change24h} />
              <CoinGridCard coin="ETH" price={prices.eth.price} change={prices.eth.change24h} />
              <CoinGridCard coin="SOL" price={prices.sol.price} change={prices.sol.change24h} />
              <CoinGridCard coin="HYPE" price={prices.hype.price} change={prices.hype.change24h} />
            </div>
          </div>

          {/* Dashboard Right: Metrics */}
          <div className="p-4 rounded-xl bg-surface/30 border border-border/30 backdrop-blur-sm flex flex-col gap-4">
            {/* Total Market Cap */}
            <div className="flex-1 flex flex-col justify-center items-center text-center p-3 rounded-lg bg-background/40 border border-border/20">
              <span className="font-mono-data text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Global Market Cap</span>
              <span className="font-mono-data text-lg font-bold text-foreground tracking-tight">
                {formatMarketCap(prices.totalMarketCap)}
              </span>
              <span className={clsx('font-mono-data text-[10px] font-medium mt-1', prices.marketCapChange24h >= 0 ? 'text-bullish' : 'text-bearish')}>
                {formatChange(prices.marketCapChange24h)}
              </span>
            </div>

            {/* Fear & Greed */}
            <div className="flex-1 flex flex-col justify-center items-center pt-2 border-t border-border/20">
              <MiniMoodGauge value={liveFG} label={liveFGLabel} />
            </div>
          </div>
        </div>

        {/* Top Stories List */}
        <div className="rounded-xl border border-border/30 bg-card/20 p-5">
          <div className="flex items-center gap-3 mb-4">
            <h4 className="font-display text-sm font-bold uppercase tracking-widest text-foreground">
              Essential Reads
            </h4>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          <div className="space-y-px">
            {summary.headlines.slice(0, 5).map((headline, idx) => (
              <a
                key={idx}
                href={headline.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-surface/60 transition-all duration-200"
              >
                <div className="font-mono-data text-[10px] text-foreground/30 mt-1.5 w-4 flex-shrink-0 group-hover:text-primary transition-colors">
                  {(idx + 1).toString().padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-thai text-[13px] font-medium leading-normal text-foreground/90 group-hover:text-primary transition-colors line-clamp-2">
                    {headline.title}
                  </h5>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="font-mono-data text-[9px] text-muted-foreground uppercase tracking-wider">
                      {headline.source}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
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
      <div className="space-y-6 p-6">
        {[1].map((i) => (
          <div key={i} className="h-[500px] rounded-2xl bg-surface/40 animate-pulse border border-border/30" />
        ))}
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl border border-dashed border-border/50 bg-surface/20 m-6">
        <p className="font-thai text-sm text-muted-foreground">
          Waiting for market summary generation...
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
