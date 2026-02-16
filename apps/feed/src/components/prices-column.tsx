'use client';

import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Loader2, TrendingUp, TrendingDown, Flame } from 'lucide-react';
import Image from 'next/image';
import { formatPrice, formatPercent, formatCompactNumber } from '@/lib/utils';

interface CoinPrice {
  id: string;
  rank: number;
  name: string;
  symbol: string;
  image: string | null;
  priceUsd: number;
  changePercent24Hr: number;
  marketCapUsd: number;
  sparkline?: number[];
}

interface PricesResponse {
  majors: CoinPrice[];
  trending: CoinPrice[];
  global: {
    totalMcap: number;
    totalVolume: number;
    btcDominance: number;
    avgChange24h: number;
  };
  asOf?: string;
}

interface MarketOverviewResponse {
  fearGreedIndex: number;
  fearGreedLabel: string;
}

async function fetchPrices(): Promise<PricesResponse> {
  const res = await fetch('/api/prices');
  if (!res.ok) throw new Error('Failed to fetch prices');
  return res.json();
}

async function fetchMarketOverview(): Promise<MarketOverviewResponse> {
  const res = await fetch('/api/market-overview');
  if (!res.ok) throw new Error('Failed to fetch market overview');
  return res.json();
}

// ─── Mini sparkline chart ───
function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 36;
  const h = 14;
  const padding = 1;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (w - 2 * padding);
    const y = h - padding - ((v - min) / range) * (h - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const color = positive ? 'hsl(var(--bullish))' : 'hsl(var(--bearish))';

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 opacity-50">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Compact semicircle gauge ───
function MoodGauge({ value, label }: { value: number; label: string }) {
  const radius = 52;
  const cx = 64;
  const cy = 58;

  const needleAngle = (180 - (value / 100) * 180) * (Math.PI / 180);
  const needleX = cx + (radius - 6) * Math.cos(needleAngle);
  const needleY = cy - (radius - 6) * Math.sin(needleAngle);

  const valueColor =
    value <= 25 ? 'text-bearish' :
      value <= 45 ? 'text-orange-500' :
        value <= 55 ? 'text-yellow-600' : 'text-bullish';

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg viewBox="0 0 128 66" className="w-full max-w-[140px]">
        <defs>
          <linearGradient id="moodGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(0, 50%, 48%)" />
            <stop offset="25%" stopColor="hsl(25, 70%, 50%)" />
            <stop offset="50%" stopColor="hsl(45, 70%, 50%)" />
            <stop offset="75%" stopColor="hsl(90, 40%, 45%)" />
            <stop offset="100%" stopColor="hsl(145, 55%, 38%)" />
          </linearGradient>
        </defs>

        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="url(#moodGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.25"
        />

        {/* Active arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="url(#moodGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * Math.PI * radius} ${Math.PI * radius}`}
        />

        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={needleX} y2={needleY}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="2.5" fill="currentColor" />

        {/* Value centered inside arc */}
        <text
          x={cx}
          y={cy - 14}
          textAnchor="middle"
          className={clsx('font-mono-data font-bold', valueColor)}
          style={{ fontSize: '20px', fill: 'currentColor' }}
        >
          {value}
        </text>
      </svg>

      {/* Label BELOW the gauge */}
      <span className={clsx(
        'font-mono-data text-[9px] font-semibold uppercase tracking-wider -mt-1',
        valueColor
      )}>
        {label}
      </span>
    </div>
  );
}

export function PricesColumn() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['prices'],
    queryFn: fetchPrices,
    refetchInterval: 60_000,
  });
  const { data: marketOverview } = useQuery({
    queryKey: ['market-overview'],
    queryFn: fetchMarketOverview,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-bearish/20 bg-bearish/5 px-3 py-2 text-xs text-bearish backdrop-blur-sm">
        Prices unavailable
      </div>
    );
  }

  const fgValue = marketOverview?.fearGreedIndex ?? 50;
  const fgLabel = marketOverview?.fearGreedLabel ?? 'Neutral';

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Section Header — Market Mood ── */}
      <div className="flex items-center justify-between px-1">
        <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          Market Mood
        </h2>
        {data.asOf && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface/50 border border-border/30">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono-data text-[9px] text-muted-foreground/70">
              {new Date(data.asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* ── Mood Gauge Container ── */}
      <div className="relative flex justify-center py-4 rounded-xl border border-border/40 bg-surface/30 backdrop-blur-md shadow-inner group transition-all duration-300 hover:bg-surface/40 hover:border-primary/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/20 pointer-events-none rounded-xl" />
        <MoodGauge value={fgValue} label={fgLabel} />
      </div>

      {/* ── Global Metrics Grid ── */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          label="Mcap"
          value={formatCompactNumber(data.global.totalMcap)}
          change={data.global.avgChange24h}
        />
        <MetricCard
          label="Volume"
          value={formatCompactNumber(data.global.totalVolume)}
        />
        <MetricCard
          label="BTC Dom"
          value={`${data.global.btcDominance.toFixed(1)}%`}
        />
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent shrink-0 my-1" />

      {/* ── Majors List ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Majors
          </h3>
        </div>
        <div className="space-y-1">
          {data.majors.map((coin) => (
            <CoinRow key={coin.id} coin={coin} showSparkline />
          ))}
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent shrink-0 my-1" />

      {/* ── Trending List ── */}
      <div className="space-y-2">
        <h3 className="flex items-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
          <Flame className="h-3 w-3 text-orange-500" />
          Trending
        </h3>
        <div className="space-y-1">
          {data.trending.map((coin) => (
            <CoinRow key={coin.id} coin={coin} compact />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Full-width coin row with sparkline ───
function CoinRow({ coin, showSparkline, compact }: { coin: CoinPrice; showSparkline?: boolean; compact?: boolean }) {
  const isPositive = coin.changePercent24Hr >= 0;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-transparent hover:border-border/40 hover:bg-surface/50 transition-all duration-200 cursor-default group">
      {/* Logo */}
      {coin.image && (
        <Image
          src={coin.image}
          alt={coin.name}
          width={compact ? 14 : 18}
          height={compact ? 14 : 18}
          className={clsx(
            'shrink-0 rounded-full grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all',
            compact ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'
          )}
        />
      )}

      {/* Symbol */}
      <span className={clsx(
        'font-medium text-foreground shrink-0 transition-colors group-hover:text-primary',
        compact ? 'text-[10px] w-9' : 'text-[11px] w-10'
      )}>
        {coin.symbol}
      </span>

      {/* Sparkline (majors only) */}
      {showSparkline && coin.sparkline && (
        <div className="w-[40px] h-[14px] shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
          <Sparkline data={coin.sparkline} positive={isPositive} />
        </div>
      )}

      {/* Spacer */}
      <span className="flex-1" />

      {/* Price */}
      <span className={clsx(
        'font-mono-data font-medium text-foreground whitespace-nowrap tabular-nums tracking-tight',
        compact ? 'text-[10px]' : 'text-[11px]'
      )}>
        {formatPrice(coin.priceUsd)}
      </span>

      {/* Change */}
      <span
        className={clsx(
          'flex items-center justify-end gap-0.5 font-mono-data font-medium whitespace-nowrap shrink-0 tabular-nums',
          compact ? 'text-[9px] w-[46px]' : 'text-[10px] w-[54px]',
          isPositive ? 'text-bullish' : 'text-bearish'
        )}
      >
        {isPositive ? (
          <TrendingUp className="h-2.5 w-2.5 shrink-0 stroke-[2.5px]" />
        ) : (
          <TrendingDown className="h-2.5 w-2.5 shrink-0 stroke-[2.5px]" />
        )}
        {formatPercent(coin.changePercent24Hr)}
      </span>
    </div>
  );
}

// Replaces broken MetricRow with a styled card
function MetricCard({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change?: number;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center p-2 rounded-lg border border-border/30 bg-surface/20 backdrop-blur-md overflow-hidden group hover:border-primary/30 transition-all duration-300">
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <span className="font-mono-data text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">
        {label}
      </span>
      <span className="font-mono-data text-xs font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
        {value}
      </span>
      {change !== undefined && (
        <span
          className={clsx(
            'font-mono-data text-[9px] font-medium mt-0.5',
            change >= 0 ? 'text-bullish' : 'text-bearish'
          )}
        >
          {formatPercent(change)}
        </span>
      )}
    </div>
  );
}
