'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Flame, ChevronDown, ChevronUp } from 'lucide-react';
import Image from 'next/image';
import { formatPrice, formatCompactNumber } from '@/lib/utils';
import { VolumeSurgeWidget, GainersLosersWidget } from './alpha-widget';
import { CompactTokenRow } from './compact-token-row';

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

const NUMERIC_TEXT_CLASS = 'font-mono-data tabular-nums tracking-tight';

function formatMovePercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
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

// ─── Compact semicircle gauge ───
function MoodGauge({ value, label }: { value: number; label: string }) {
  const radius = 52;
  const cx = 64;
  const cy = 58;

  const needleAngle = (180 - (value / 100) * 180) * (Math.PI / 180);
  const needleX = cx + (radius - 6) * Math.cos(needleAngle);
  const needleY = cy - (radius - 6) * Math.sin(needleAngle);

  const valueColor =
    value <= 25
      ? 'text-bearish'
      : value <= 45
        ? 'text-orange-500'
        : value <= 55
          ? 'text-yellow-600'
          : 'text-bullish';

  return (
    <div
      className="flex flex-col items-center gap-2 pt-2"
      role="img"
      aria-label={`Fear and Greed Index: ${value}, ${label}`}
    >
      <svg
        viewBox="0 0 128 72"
        className="w-full max-w-[150px] overflow-visible drop-shadow-[0_2px_8px_rgba(2ef44444,0.3)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="moodGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            {/* Hard-coded hex values to prevent stop-color variable parsing errors */}
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#84cc16" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>

        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="url(#moodGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.2"
          className="text-muted-foreground"
          strokeDasharray="2 6"
        />

        {/* Active arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="url(#moodGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * Math.PI * radius} ${Math.PI * radius}`}
          className="transition-all duration-1000 ease-out"
        />

        {/* Needle Reticle */}
        <circle
          cx={needleX}
          cy={needleY}
          r="6"
          fill="currentColor"
          opacity="0.2"
          className={valueColor}
        />
        <circle cx={needleX} cy={needleY} r="3" fill="currentColor" className={valueColor} />
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          className="text-muted-foreground opacity-30"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="2.5" className="text-muted-foreground" fill="currentColor" />

        {/* Value centered inside arc */}
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          className={clsx('font-mono-data font-bold tracking-tighter', valueColor)}
          style={{
            fontSize: '32px',
            fill: 'currentColor',
            filter: 'drop-shadow(0px 0px 8px currentColor)',
          }}
        >
          {value}
        </text>
      </svg>

      {/* Label BELOW the gauge */}
      <span
        className={clsx(
          'font-mono-data text-micro font-semibold uppercase tracking-wider -mt-1',
          valueColor
        )}
      >
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
          <div className="h-16 rounded-lg bg-surface/30" />
          <div className="h-16 rounded-lg bg-surface/30" />
          <div className="h-16 rounded-lg bg-surface/30" />
        </div>
        <div className="space-y-2">
          <div className="h-10 rounded-lg bg-surface/30" />
          <div className="h-10 rounded-lg bg-surface/30" />
          <div className="h-10 rounded-lg bg-surface/30" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-bearish/25 bg-bearish/5 px-unit-4 py-unit-3 text-small text-bearish backdrop-blur-sm">
        Prices unavailable. Please refresh in a moment.
      </div>
    );
  }

  const fgValue = marketOverview?.fearGreedIndex ?? 50;
  const fgLabel = marketOverview?.fearGreedLabel ?? 'Neutral';
  const asOfLabel = data.asOf
    ? new Date(data.asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  const trendingItems = data.trending.slice(0, 5);
  const trendingMaxAbsChange = Math.max(
    ...trendingItems.map((coin) => Math.abs(coin.changePercent24Hr)),
    1
  );

  return (
    <div className="flex h-full flex-col gap-unit-4">
      {/* ── Section Header — Market Mood ── */}
      <div className="flex items-center justify-between px-1">
        <h2 className="font-display text-caption font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/60" aria-hidden="true" />
          Market Mood
        </h2>
        {asOfLabel && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface/50 border border-border/30">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            <span className={clsx(NUMERIC_TEXT_CLASS, 'text-micro text-muted-foreground/70')}>
              {asOfLabel}
            </span>
          </div>
        )}
      </div>

      {/* ── Mood Gauge Container ── */}
      <div className="relative flex justify-center py-4 min-h-[140px] rounded-2xl border border-border/40 bg-surface/30 backdrop-blur-md shadow-inner group transition-all duration-normal hover:bg-surface/40 hover:border-primary/30 overflow-visible">
        <div
          className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/10 to-transparent"
          aria-hidden="true"
        />
        <MoodGauge value={fgValue} label={fgLabel} />
      </div>

      {/* ── Global Metrics ── */}
      <div className="rounded-xl border border-border/30 bg-surface/20 backdrop-blur-md overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-border/25">
          <MetricCard
            label="Mcap"
            value={formatCompactNumber(data.global.totalMcap)}
            change={data.global.avgChange24h}
          />
          <MetricCard label="Volume" value={formatCompactNumber(data.global.totalVolume)} />
          <MetricCard label="BTC Dom" value={`${data.global.btcDominance.toFixed(1)}%`} />
        </div>
      </div>

      <div
        className="h-px bg-gradient-to-r from-transparent via-border/35 to-transparent shrink-0 my-1"
        aria-hidden="true"
      />

      {/* ── Majors List ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-display text-caption font-bold uppercase tracking-widest text-muted-foreground">
            Majors
          </h3>
          <div className="flex items-center gap-1.5">
            <span
              className={clsx(
                NUMERIC_TEXT_CLASS,
                'rounded-full border border-border/45 bg-card/50 px-2 py-0.5 text-micro uppercase tracking-[0.14em] text-muted-foreground/85 whitespace-nowrap leading-none'
              )}
            >
              24h
            </span>
            {asOfLabel && (
              <span
                className={clsx(
                  NUMERIC_TEXT_CLASS,
                  'rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-micro uppercase tracking-[0.14em] text-primary/90 whitespace-nowrap leading-none'
                )}
              >
                Updated {asOfLabel}
              </span>
            )}
          </div>
        </div>
        <div
          className="rounded-xl border border-border/25 bg-surface/10 overflow-hidden"
          role="list"
          aria-label="Major cryptocurrencies"
        >
          {data.majors.map((coin) => (
            <CoinRow key={coin.id} coin={coin} showSparkline />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowExtendedMobile((prev) => !prev)}
        className="md:hidden inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border/55 bg-card/70 px-4 font-mono-data text-caption font-semibold uppercase tracking-[0.18em] text-foreground/85 transition-colors duration-fast hover:border-primary/40 hover:text-primary focus-ring"
        aria-expanded={showExtendedMobile}
        aria-controls="extended-signals"
      >
        {showExtendedMobile ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        {showExtendedMobile ? 'Hide Extended Signals' : 'Show Extended Signals'}
      </button>

      <div id="extended-signals" className={clsx(showExtendedMobile ? 'block' : 'hidden md:block')}>
        <div
          className="h-px bg-gradient-to-r from-transparent via-border/35 to-transparent shrink-0 my-2"
          aria-hidden="true"
        />

        {/* ── Gainers & Losers ── */}
        <div>
          <GainersLosersWidget />
        </div>

        <div
          className="h-px bg-gradient-to-r from-transparent via-border/35 to-transparent shrink-0 my-2"
          aria-hidden="true"
        />

        {/* ── Trending & Vol Surge ── */}
        <div className="grid grid-cols-1 gap-3 pb-4 md:grid-cols-2 md:gap-2">
          {/* Trending */}
          <div className="flex flex-col gap-2 min-h-0">
            <div className="flex items-center gap-1 px-1">
              <div className="p-0.5 rounded bg-orange-500/10 border border-orange-500/20">
                <Flame
                  className="h-2.5 w-2.5 text-orange-500 fill-orange-500/20"
                  style={{ animationDelay: '2s' }}
                  aria-hidden="true"
                />
              </div>
              <h3 className="font-display text-caption font-bold uppercase tracking-[0.12em] text-orange-500/90">
                Trending
              </h3>
            </div>
            <div
              className="space-y-0.5 p-1 rounded-xl bg-surface/12 border border-border/30 backdrop-blur-sm overflow-hidden overflow-x-hidden"
              role="list"
              aria-label="Trending cryptocurrencies"
            >
              {trendingItems.map((coin) => (
                <CompactTokenRow
                  key={coin.id}
                  symbol={coin.symbol}
                  image={coin.image}
                  change={coin.changePercent24Hr}
                  maxAbsChange={trendingMaxAbsChange}
                  ariaLabel={`${coin.name} ${formatMovePercent(coin.changePercent24Hr)} ${coin.changePercent24Hr >= 0 ? 'up' : 'down'}`}
                />
              ))}
            </div>
          </div>

          {/* Vol Surge */}
          <div className="flex flex-col gap-2 min-h-0">
            <VolumeSurgeWidget />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Full-width coin row with sparkline ───
function CoinRow({
  coin,
  showSparkline,
  compact,
}: {
  coin: CoinPrice;
  showSparkline?: boolean;
  compact?: boolean;
}) {
  const isPositive = coin.changePercent24Hr >= 0;
  const directionLabel = isPositive ? 'up' : 'down';

  // Compact rows are rendered by CompactTokenRow in the trending panel.
  if (compact) return null;

  // Full mode (Majors)
  const accentColor = isPositive ? 'hsl(var(--bullish))' : 'hsl(var(--bearish))';

  const sparklineSvg = (() => {
    if (!showSparkline || !coin.sparkline || coin.sparkline.length < 2) return null;
    const d = coin.sparkline;
    const lo = Math.min(...d),
      hi = Math.max(...d);
    const range = hi - lo || 1;
    const W = 100,
      H = 36,
      pad = 1.5;
    const pts = d.map((v, i) => ({
      x: pad + (i / (d.length - 1)) * (W - 2 * pad),
      y: H - pad - ((v - lo) / range) * (H - 2 * pad),
    }));
    const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
    const area = `M ${pts[0].x},${H} ${pts.map((p) => `L ${p.x},${p.y}`).join(' ')} L ${pts[pts.length - 1].x},${H} Z`;
    const gid = `sg-${coin.id}`;
    return (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        role="img"
        aria-label={`24h price chart, trending ${directionLabel}`}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={`${pad},${H - pad} ${W - pad},${H - pad}`}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="0.8"
          strokeOpacity="0.45"
          vectorEffect="non-scaling-stroke"
        />
        <path d={area} fill={`url(#${gid})`} />
        <polyline
          points={line}
          fill="none"
          stroke={accentColor}
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  })();

  return (
    <div
      className={clsx(
        'group relative grid grid-cols-[30px_74px_1fr_auto_auto] items-center gap-2.5 px-2 py-3.5 cursor-default',
        'border-b border-border/15 last:border-0',
        'transition-colors duration-fast',
        isPositive ? 'hover:bg-bullish/[0.04]' : 'hover:bg-bearish/[0.04]'
      )}
      role="listitem"
      aria-label={`${coin.name} ${formatPrice(coin.priceUsd)} ${formatMovePercent(coin.changePercent24Hr)} ${directionLabel}`}
    >
      {/* Left accent bar */}
      <div
        className={clsx(
          'absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-7 rounded-full',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-fast',
          isPositive ? 'bg-bullish' : 'bg-bearish'
        )}
        aria-hidden="true"
      />

      {/* Icon with hover ring */}
      <div className="relative shrink-0 ml-1">
        <div
          className={clsx(
            'absolute -inset-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-normal',
            isPositive ? 'bg-bullish/10' : 'bg-bearish/10'
          )}
          aria-hidden="true"
        />
        {coin.image ? (
          <Image
            src={coin.image}
            alt=""
            width={30}
            height={30}
            className="relative h-[30px] w-[30px] rounded-full grayscale opacity-55 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-slow"
          />
        ) : (
          <div className="relative h-[30px] w-[30px] rounded-full bg-surface/50 flex items-center justify-center">
            <span className="text-micro font-bold text-muted-foreground">
              {coin.symbol.slice(0, 2)}
            </span>
          </div>
        )}
      </div>

      {/* Symbol + full name */}
      <div className="min-w-0">
        <div className="font-mono-data text-small font-bold text-foreground tracking-tight leading-none">
          {coin.symbol}
        </div>
        <div className="text-micro text-muted-foreground/85 mt-1 truncate uppercase tracking-[0.1em]">
          {coin.name}
        </div>
      </div>

      {/* Gradient sparkline */}
      <div className="min-w-0 h-9 opacity-60 group-hover:opacity-100 transition-opacity duration-normal">
        {sparklineSvg}
      </div>

      {/* Price */}
      <div className="min-w-[82px] text-right">
        <div
          className={clsx(NUMERIC_TEXT_CLASS, 'text-small font-bold text-foreground leading-none')}
        >
          {formatPrice(coin.priceUsd)}
        </div>
      </div>

      {/* Change % pill badge */}
      <div
        className={clsx(
          'min-w-[72px] justify-end shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full',
          `${NUMERIC_TEXT_CLASS} text-caption font-semibold whitespace-nowrap transition-all duration-fast group-hover:translate-x-0.5`,
          'border transition-colors duration-fast',
          isPositive
            ? 'text-bullish/95 bg-bullish/10 border-bullish/25 group-hover:bg-bullish/15'
            : 'text-bearish/95 bg-bearish/14 border-bearish/30 group-hover:bg-bearish/20'
        )}
      >
        {formatMovePercent(coin.changePercent24Hr)}
      </div>
    </div>
  );
}

// ─── Metric card (used in the 3-column grid) ───
function MetricCard({ label, value, change }: { label: string; value: string; change?: number }) {
  return (
    <div className="relative flex flex-col items-center justify-center p-unit-2 overflow-hidden group hover:bg-surface/30 transition-all duration-normal">
      <div
        className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />

      <span className="font-mono-data text-micro text-muted-foreground/70 uppercase tracking-wider mb-0.5">
        {label}
      </span>
      <span
        className={clsx(
          NUMERIC_TEXT_CLASS,
          'text-label font-bold text-foreground group-hover:text-primary transition-colors duration-fast'
        )}
      >
        {value}
      </span>
      {change !== undefined && (
        <span
          className={clsx(
            `${NUMERIC_TEXT_CLASS} text-micro font-medium mt-0.5 flex items-center gap-0.5`,
            change >= 0 ? 'text-bullish' : 'text-bearish'
          )}
        >
          {formatMovePercent(change)}
        </span>
      )}
    </div>
  );
}
