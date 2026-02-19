'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { clsx } from 'clsx';
import { SummaryModal } from './summary-modal';
import { FileText, Maximize2, ChevronRight, ExternalLink } from 'lucide-react';

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



// ─── Refined Components ───

function CompactSummaryCard({ summary }: { summary: Summary }) {
  const [isOpen, setIsOpen] = useState(false);
  const isMorning = summary.scheduleType === 'morning';
  const label = isMorning ? 'EARLY INTELLIGENCE' : 'MARKET CLOSE WRAP';
  const subLabel = isMorning ? 'Morning Briefing' : 'Evening Briefing';

  // Derive details
  const fgIndex = summary.prices?.fearGreedIndex ?? 50;
  const sentiment = fgIndex >= 55 ? 'BULLISH' : fgIndex <= 45 ? 'BEARISH' : 'NEUTRAL';
  const sentimentColor = fgIndex >= 55 ? 'text-bullish shadow-bullish/20' : fgIndex <= 45 ? 'text-bearish shadow-bearish/20' : 'text-muted-foreground';
  const accentGradient = isMorning
    ? 'from-orange-500/20 via-orange-500/5 to-transparent'
    : 'from-blue-500/20 via-blue-500/5 to-transparent';
  const borderAccent = isMorning ? 'border-orange-500/30' : 'border-blue-500/30';

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className="group relative w-full cursor-pointer overflow-hidden rounded-xl bg-card border border-border/40 hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5"
      >
        {/* Dynamic Background Glow */}
        <div className={`absolute inset-0 bg-gradient-to-r ${accentGradient} opacity-20 group-hover:opacity-40 transition-opacity duration-500`} />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light" />

        {/* Active scan line effect */}
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-transparent via-primary to-transparent opacity-50 group-hover:opacity-100 group-hover:h-full transition-all duration-700 h-1/3" />

        <div className="relative flex items-center justify-between p-4 sm:p-5">
          {/* Left: Identity */}
          <div className="flex items-center gap-4">
            <div className={clsx(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-surface/50 backdrop-blur-sm shadow-inner transition-transform group-hover:scale-105",
              borderAccent
            )}>
              <span className="text-2xl filter drop-shadow-md">{isMorning ? '🌅' : '🌆'}</span>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-bold uppercase tracking-widest text-foreground/90 group-hover:text-primary transition-colors">
                  {subLabel}
                </h3>
                <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
              </div>
              <p className="font-mono-data text-[10px] text-muted-foreground/80 font-medium">
                {formatDateRich(summary.createdAt)} • {formatTime(summary.createdAt)} UTC
              </p>
            </div>
          </div>

          {/* Center/Right: Data & Action */}
          <div className="flex items-center gap-6">
            {/* Sentiment Pill */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="font-mono-data text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Market Mood</span>
              <div className={clsx("font-display text-base font-bold tracking-tight drop-shadow-sm", sentimentColor)}>
                {sentiment}
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="hidden sm:block h-8 w-px bg-border/40" />

            {/* Stats */}
            <div className="hidden sm:flex flex-col items-end min-w-[60px]">
              <span className="font-mono-data text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">Coverage</span>
              <div className="font-mono-data text-sm font-bold text-foreground">
                {summary.headlines.length} <span className="text-[10px] text-muted-foreground font-normal">Stories</span>
              </div>
            </div>

            {/* Button */}
            <div className="pl-4 border-l border-border/20 sm:border-0 sm:pl-0">
              <button className="flex items-center justify-center h-10 w-10 sm:w-auto sm:px-4 sm:gap-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all group-hover:border-primary/40 group-hover:shadow-[0_0_15px_rgba(var(--primary),0.15)]">
                <Maximize2 className="w-4 h-4" />
                <span className="hidden sm:block font-mono-data text-[10px] font-bold uppercase tracking-wider">Read</span>
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar / Decorator at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border/20">
          <div className={`h-full bg-gradient-to-r ${isMorning ? 'from-orange-500 to-yellow-500' : 'from-blue-500 to-purple-500'} w-[30%] group-hover:w-full transition-all duration-1000 ease-out opacity-70`} />
        </div>
      </div>

      <SummaryModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={label}
        date={formatDateRich(summary.createdAt)}
      >
        <FullSummaryContent summary={summary} />
      </SummaryModal>
    </>
  );
}

function FullSummaryContent({ summary }: { summary: Summary }) {
  const isMorning = summary.scheduleType === 'morning';
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
    <div className="space-y-8">
      {/* 
        DASHBOARD HEADER 
        Two main cards: Left (Sentiment/Mood), Right (Key Assets)
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Market Mood */}
        <div className="relative overflow-hidden rounded-2xl bg-surface/30 border border-white/5 p-5 flex items-center justify-between">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5" />
          <div className="relative z-10">
            <h4 className="font-mono-data text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Market Sentiment</h4>
            <div className="text-3xl font-display font-bold text-foreground tracking-tight">{liveFGLabel}</div>
            <div className="text-xs font-mono-data text-muted-foreground/60 mt-1">Index: {liveFG}/100</div>
          </div>
          <div className="relative z-10 scale-90 origin-right">
            <MiniMoodGauge value={liveFG} label="" />
          </div>
        </div>

        {/* Card 2: Market Cap & Dominance (Replaced Key Movers with Global Stats for higher level view) */}
        <div className="relative overflow-hidden rounded-2xl bg-surface/30 border border-white/5 p-5 flex flex-col justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5" />
          <div className="relative z-10 flex items-center justify-between mb-4">
            <div>
              <h4 className="font-mono-data text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Global Cap</h4>
              <div className="text-2xl font-mono-data font-bold tracking-tight text-foreground">{formatMarketCap(prices.totalMarketCap)}</div>
            </div>
            <div className={clsx("px-2 py-1 rounded text-xs font-bold font-mono-data", prices.marketCapChange24h >= 0 ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish")}>
              {formatChange(prices.marketCapChange24h)}
            </div>
          </div>
          {/* Mini strip of coins */}
          <div className="relative z-10 flex items-center gap-2">
            <PriceChip coin="BTC" price={prices.btc.price} change={prices.btc.change24h} />
            <PriceChip coin="ETH" price={prices.eth.price} change={prices.eth.change24h} />
            <PriceChip coin="SOL" price={prices.sol.price} change={prices.sol.change24h} />
          </div>
        </div>
      </div>

      {/* 
        MAIN EDITORIAL CONTENT 
        Two column layout on large screens: Text Left, Stories Right
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Text Column */}
        <div className="lg:col-span-8">
          <div className="prose prose-invert prose-p:font-thai prose-p:text-lg prose-p:leading-8 prose-p:text-foreground/90 max-w-none">
            <div className="mb-6 flex items-center gap-2 pb-4 border-b border-border/10">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="font-mono-data text-xs font-bold uppercase tracking-[0.2em] text-primary">Executive Summary</span>
            </div>
            <FormattedSummary text={summary.summaryText} />
          </div>
        </div>

        {/* Stories Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-xl border border-white/5 bg-surface/20 p-5">
            <h4 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <FileText className="w-3 h-3" />
              Source Material
            </h4>
            <div className="space-y-3">
              {summary.headlines.slice(0, 5).map((headline, idx) => (
                <a
                  key={idx}
                  href={headline.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block p-3 rounded-lg bg-background/40 hover:bg-background/80 border border-transparent hover:border-border/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-mono-data text-[9px] font-bold text-primary/70 group-hover:text-primary">
                      {(idx + 1).toString().padStart(2, '0')}
                    </span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-foreground opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                  <h5 className="font-thai text-xs font-medium leading-relaxed text-foreground/80 group-hover:text-foreground line-clamp-2">
                    {headline.title}
                  </h5>
                  <div className="mt-2 text-[9px] font-mono-data text-muted-foreground uppercase tracking-wider">
                    {headline.source}
                  </div>
                </a>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 text-center">
              <span className="font-mono-data text-[9px] text-muted-foreground/50">
                Based on {summary.articleCount} analyzed articles
              </span>
            </div>
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
          // Keep only the latest 1 summary as requested
          setSummaries(data.slice(0, 1));
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
      <div className="h-[88px] rounded-xl bg-surface/40 animate-pulse border border-border/30" />
    );
  }

  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {summaries.map((summary) => (
        <CompactSummaryCard key={summary.id} summary={summary} />
      ))}
    </div>
  );
}
