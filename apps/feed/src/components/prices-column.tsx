'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import Image from 'next/image';
import { formatPrice, formatPercent, formatCompactNumber } from '@/lib/utils';
import { VolumeSurgeWidget, GainersLosersWidget } from './alpha-widget';

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
  const w = 56;
  const h = 20;
  const padding = 1;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (w - 2 * padding);
    const y = h - padding - ((v - min) / range) * (h - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const color = positive ? 'hsl(var(--bullish))' : 'hsl(var(--bearish))';

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} className="opacity-85">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
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
  const [showExtendedMobile, setShowExtendedMobile] = useState(false);
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
      <div className="space-y-3 animate-pulse">
        <div className="h-4 w-32 rounded bg-surface/70" />
        <div className="h-28 rounded-xl border border-border/30 bg-surface/40" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-16 rounded-lg border border-border/30 bg-surface/30" />
          <div className="h-16 rounded-lg border border-border/30 bg-surface/30" />
          <div className="h-16 rounded-lg border border-border/30 bg-surface/30" />
        </div>
        <div className="space-y-2">
          <div className="h-10 rounded-lg border border-border/30 bg-surface/30" />
          <div className="h-10 rounded-lg border border-border/30 bg-surface/30" />
          <div className="h-10 rounded-lg border border-border/30 bg-surface/30" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-bearish/25 bg-bearish/5 px-4 py-3 text-xs text-bearish backdrop-blur-sm">
        Prices unavailable. Please refresh in a moment.
      </div>
    );
  }

  const fgValue = marketOverview?.fearGreedIndex ?? 50;
  const fgLabel = marketOverview?.fearGreedLabel ?? 'Neutral';

  return (
    <div className="flex h-full flex-col gap-4">
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

      <div className="h-px bg-gradient-to-r from-transparent via-border/35 to-transparent shrink-0 my-1" />

      {/* ── Majors List ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Majors
          </h3>
        </div>
        <div className="rounded-xl border border-border/25 bg-surface/10 overflow-hidden">
          {data.majors.map((coin) => (
            <CoinRow key={coin.id} coin={coin} showSparkline />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowExtendedMobile((prev) => !prev)}
        className="md:hidden inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border/55 bg-card/70 px-4 font-mono-data text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/85 transition-colors hover:border-primary/40 hover:text-primary"
        aria-expanded={showExtendedMobile}
      >
        {showExtendedMobile ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {showExtendedMobile ? 'Hide Extended Signals' : 'Show Extended Signals'}
      </button>

      <div className={clsx(showExtendedMobile ? 'block' : 'hidden md:block')}>
        <div className="h-px bg-gradient-to-r from-transparent via-border/35 to-transparent shrink-0 my-2" />

        {/* ── Gainers & Losers (Split) ── */}
        <div className="h-[250px] shrink-0">
          <GainersLosersWidget />
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border/35 to-transparent shrink-0 my-2" />

        {/* ── Trending & Vol Surge (Split) ── */}
        <div className="grid grid-cols-1 gap-3 pb-4 md:grid-cols-2 md:gap-2">
          {/* Trending (Left) */}
          <div className="flex flex-col gap-2 min-h-0">
            <div className="flex items-center gap-1 px-1">
              <div className="p-0.5 rounded bg-orange-500/10 border border-orange-500/20">
                <Flame className="h-2.5 w-2.5 text-orange-500 fill-orange-500/20 animate-pulse" />
              </div>
              <h3 className="font-display text-[9px] font-bold uppercase tracking-widest text-orange-500/90">
                Trending
              </h3>
            </div>
            <div className="space-y-0.5 p-1 rounded-xl bg-orange-500/5 border border-orange-500/10 backdrop-blur-sm overflow-hidden">
              {data.trending.slice(0, 5).map((coin) => (
                <CoinRow key={coin.id} coin={coin} compact />
              ))}
            </div>
          </div>

          {/* Vol Surge (Right) */}
          <div className="flex flex-col gap-2 min-h-0">
            <VolumeSurgeWidget />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Full-width coin row with sparkline ───
function CoinRow({ coin, showSparkline, compact }: { coin: CoinPrice; showSparkline?: boolean; compact?: boolean }) {
  const isPositive = coin.changePercent24Hr >= 0;

  // Compact mode (Trending panel): icon | symbol | change% — no price, fits narrow column
  if (compact) {
    return (
      <div className="group grid grid-cols-[14px_1fr_46px] items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 transition-all duration-200 hover:border-border/40 hover:bg-surface/50 cursor-default">
        {coin.image && (
          <Image
            src={coin.image}
            alt={coin.name}
            width={14}
            height={14}
            className="h-3.5 w-3.5 shrink-0 rounded-full grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
          />
        )}
        <span className="font-medium text-[10px] text-foreground transition-colors group-hover:text-primary truncate">
          {coin.symbol}
        </span>
        <span className={clsx(
          'flex items-center justify-end gap-0.5 font-mono-data text-[9px] font-medium whitespace-nowrap tabular-nums',
          isPositive ? 'text-bullish' : 'text-bearish'
        )}>
          {isPositive ? (
            <TrendingUp className="h-2 w-2 shrink-0 stroke-[2.5px]" />
          ) : (
            <TrendingDown className="h-2 w-2 shrink-0 stroke-[2.5px]" />
          )}
          {formatPercent(coin.changePercent24Hr)}
        </span>
      </div>
    );
  }

  // Full mode (Majors): premium card row with gradient sparkline, pill badge, icon glow
  const accentColor = isPositive ? 'hsl(var(--bullish))' : 'hsl(var(--bearish))';

  const sparklineSvg = (() => {
    if (!showSparkline || !coin.sparkline || coin.sparkline.length < 2) return null;
    const d = coin.sparkline;
    const lo = Math.min(...d), hi = Math.max(...d);
    const range = hi - lo || 1;
    const W = 100, H = 36, pad = 1.5;
    const pts = d.map((v, i) => ({
      x: pad + (i / (d.length - 1)) * (W - 2 * pad),
      y: H - pad - ((v - lo) / range) * (H - 2 * pad),
    }));
    const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
    const area = `M ${pts[0].x},${H} ${pts.map((p) => `L ${p.x},${p.y}`).join(' ')} L ${pts[pts.length - 1].x},${H} Z`;
    const gid = `sg-${coin.id}`;
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <polyline
          points={line}
          fill="none"
          stroke={accentColor}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  })();

  return (
    <div className={clsx(
      'group relative flex items-center gap-3 px-2 py-3 cursor-default',
      'border-b border-border/15 last:border-0',
      'transition-colors duration-200',
      isPositive ? 'hover:bg-bullish/[0.04]' : 'hover:bg-bearish/[0.04]',
    )}>
      {/* Left accent bar */}
      <div className={clsx(
        'absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-7 rounded-full',
        'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
        isPositive ? 'bg-bullish' : 'bg-bearish',
      )} />

      {/* Icon with hover ring */}
      <div className="relative shrink-0 ml-1">
        <div className={clsx(
          'absolute -inset-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300',
          isPositive ? 'bg-bullish/10' : 'bg-bearish/10',
        )} />
        {coin.image ? (
          <Image
            src={coin.image}
            alt={coin.name}
            width={30}
            height={30}
            className="relative h-[30px] w-[30px] rounded-full grayscale opacity-55 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-400"
          />
        ) : (
          <div className="relative h-[30px] w-[30px] rounded-full bg-surface/50 flex items-center justify-center">
            <span className="text-[9px] font-bold text-muted-foreground">{coin.symbol.slice(0, 2)}</span>
          </div>
        )}
      </div>

      {/* Symbol + full name */}
      <div className="shrink-0 w-[72px]">
        <div className="font-mono-data text-[13px] font-bold text-foreground tracking-tight leading-none">
          {coin.symbol}
        </div>
        <div className="text-[8px] text-muted-foreground/40 mt-1 truncate uppercase tracking-[0.08em]">
          {coin.name}
        </div>
      </div>

      {/* Gradient sparkline — fills all available space */}
      <div className="flex-1 min-w-0 h-9 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
        {sparklineSvg}
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        <div className="font-mono-data text-[13px] font-bold text-foreground tabular-nums tracking-tight leading-none">
          {formatPrice(coin.priceUsd)}
        </div>
      </div>

      {/* Change % pill badge */}
      <div className={clsx(
        'shrink-0 flex items-center gap-1 px-2 py-1 rounded-full',
        'font-mono-data text-[10px] font-bold tabular-nums whitespace-nowrap',
        'border transition-colors duration-200',
        isPositive
          ? 'text-bullish bg-bullish/10 border-bullish/20 group-hover:bg-bullish/15'
          : 'text-bearish bg-bearish/10 border-bearish/20 group-hover:bg-bearish/15',
      )}>
        {isPositive
          ? <TrendingUp className="h-2.5 w-2.5 stroke-[2.5]" />
          : <TrendingDown className="h-2.5 w-2.5 stroke-[2.5]" />
        }
        {formatPercent(coin.changePercent24Hr)}
      </div>
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
