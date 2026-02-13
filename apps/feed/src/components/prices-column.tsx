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
      <div className="rounded-lg border border-bearish/20 bg-bearish/5 px-3 py-2 text-xs text-bearish">
        Prices unavailable
      </div>
    );
  }

  const fgValue = marketOverview?.fearGreedIndex ?? 50;
  const fgLabel = marketOverview?.fearGreedLabel ?? 'Neutral';

  return (
    <div className="flex flex-col gap-2.5 h-full">
      {/* ── Section Header — Market Mood ── */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-foreground">
          Market Mood
        </h2>
        {data.asOf && (
          <span className="font-mono-data text-[9px] text-muted-foreground/50">
            {new Date(data.asOf).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* ── Row 1: Gauge centered ── */}
      <div className="flex justify-center">
        <MoodGauge value={fgValue} label={fgLabel} />
      </div>

      {/* ── Row 2: Global metrics — full-width grid ── */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface/30 p-2">
        <MetricRow
          label="Mcap"
          value={formatCompactNumber(data.global.totalMcap)}
          change={data.global.avgChange24h}
        />
        <MetricRow
          label="Volume"
          value={formatCompactNumber(data.global.totalVolume)}
        />
        <MetricRow
          label="BTC Dom"
          value={`${data.global.btcDominance.toFixed(1)}%`}
        />
      </div>

      {/* Gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent shrink-0" />

      {/* ── Row 2: Majors — full width with sparklines ── */}
      <div>
        <div className="flex items-baseline justify-between px-1 mb-1">
          <h3 className="font-display text-[10px] font-bold uppercase tracking-wider text-foreground">
            Majors
          </h3>
        </div>
        <div className="space-y-0">
          {data.majors.map((coin) => (
            <CoinRow key={coin.id} coin={coin} showSparkline />
          ))}
        </div>
      </div>

      {/* Gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent shrink-0" />

      {/* ── Row 3: Trending — full width ── */}
      <div>
        <h3 className="flex items-center gap-1 font-display text-[10px] font-bold uppercase tracking-wider text-foreground px-1 mb-1">
          <Flame className="h-3 w-3 text-orange-500" />
          Trending
        </h3>
        <div className="space-y-0">
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
    <div className="flex items-center gap-1.5 px-1 py-1.5 rounded-md coin-row-hover cursor-default overflow-hidden">
      {/* Logo */}
      {coin.image && (
        <Image
          src={coin.image}
          alt={coin.name}
          width={compact ? 14 : 18}
          height={compact ? 14 : 18}
          className={clsx(
            'shrink-0 rounded-full',
            compact ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'
          )}
        />
      )}

      {/* Symbol */}
      <span className={clsx(
        'font-medium text-foreground shrink-0',
        compact ? 'text-[10px] w-9' : 'text-[11px] w-10'
      )}>
        {coin.symbol}
      </span>

      {/* Sparkline (majors only) */}
      {showSparkline && coin.sparkline && (
        <Sparkline data={coin.sparkline} positive={isPositive} />
      )}

      {/* Spacer */}
      <span className="flex-1" />

      {/* Price */}
      <span className={clsx(
        'font-mono-data font-medium text-foreground whitespace-nowrap price-hover-scale',
        compact ? 'text-[10px]' : 'text-[11px]'
      )}>
        {formatPrice(coin.priceUsd)}
      </span>

      {/* Change */}
      <span
        className={clsx(
          'flex items-center gap-0.5 font-mono-data font-medium whitespace-nowrap shrink-0',
          compact ? 'text-[8px] w-[46px]' : 'text-[9px] w-[52px]',
          'text-right justify-end',
          isPositive ? 'text-bullish' : 'text-bearish'
        )}
      >
        {isPositive ? (
          <TrendingUp className="h-2 w-2 shrink-0" />
        ) : (
          <TrendingDown className="h-2 w-2 shrink-0" />
        )}
        {formatPercent(coin.changePercent24Hr)}
      </span>
    </div>
  );
}

function MetricRow({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className="font-mono-data text-[8px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="font-mono-data text-[11px] font-bold text-foreground leading-none">
        {value}
      </span>
      {change !== undefined && (
        <span
          className={clsx(
            'font-mono-data text-[8px] font-medium',
            change >= 0 ? 'text-bullish' : 'text-bearish'
          )}
        >
          {formatPercent(change)}
        </span>
      )}
    </div>
  );
}
