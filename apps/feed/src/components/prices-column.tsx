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
        <Loader2 className="h-5 w-5 animate-spin text-accent/50" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-bearish/30 bg-bearish/10 px-3 py-2 text-xs text-bearish">
        Prices unavailable
      </div>
    );
  }

  const fgValue = marketOverview?.fearGreedIndex ?? 50;
  const fgLabel = marketOverview?.fearGreedLabel ?? 'Neutral';

  return (
    <div className="space-y-4">
      {/* Majors section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Majors
          </h3>
          {data.asOf && (
            <span className="font-mono-data text-[9px] text-muted-foreground/60">
              {new Date(data.asOf).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="space-y-1">
          {data.majors.map((coin) => (
            <CoinRow key={coin.id} coin={coin} />
          ))}
        </div>
      </div>

      {/* Trending section */}
      <div className="space-y-2">
        <h3 className="flex items-center gap-1.5 font-mono-data text-[10px] uppercase tracking-[0.2em] text-orange-400 px-2">
          <Flame className="h-3 w-3" />
          Trending
        </h3>
        <div className="space-y-1">
          {data.trending.map((coin) => (
            <CoinRow key={coin.id} coin={coin} />
          ))}
        </div>
      </div>

      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />

      {/* Market metrics */}
      <div className="space-y-3 px-2">
        <MetricRow
          label="Market Cap"
          value={formatCompactNumber(data.global.totalMcap)}
          change={data.global.avgChange24h}
        />
        <MetricRow
          label="24H Volume"
          value={formatCompactNumber(data.global.totalVolume)}
        />
        <MetricRow
          label="BTC Dom."
          value={`${data.global.btcDominance.toFixed(1)}%`}
        />

        {/* Fear & Greed */}
        <div className="space-y-2 pt-2 border-t border-border/30">
          <div className="flex items-baseline justify-between">
            <span className="font-mono-data text-[10px] text-muted-foreground uppercase tracking-wider">
              Fear & Greed
            </span>
            <span className={clsx(
              'font-mono-data text-lg font-bold',
              fgValue <= 25 ? 'text-bearish' :
              fgValue <= 45 ? 'text-orange-400' :
              fgValue <= 55 ? 'text-yellow-400' : 'text-bullish'
            )}>
              {fgValue}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-bearish via-yellow-500 to-bullish transition-all duration-500"
              style={{ width: `${fgValue}%` }}
            />
          </div>
          <span className="font-mono-data text-[10px] text-muted-foreground/80">
            {fgLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function CoinRow({ coin }: { coin: CoinPrice }) {
  const isPositive = coin.changePercent24Hr >= 0;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface/40 transition-colors">
      {coin.image && (
        <Image
          src={coin.image}
          alt={coin.name}
          width={20}
          height={20}
          className="h-5 w-5 shrink-0 rounded-full"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground truncate">
            {coin.symbol}
          </span>
          <span className="font-mono-data text-[10px] text-muted-foreground whitespace-nowrap">
            {formatPrice(coin.priceUsd)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={clsx(
              'flex items-center gap-0.5 font-mono-data text-[9px] font-medium',
              isPositive ? 'text-bullish' : 'text-bearish'
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-2 w-2" />
            ) : (
              <TrendingDown className="h-2 w-2" />
            )}
            {formatPercent(coin.changePercent24Hr)}
          </span>
        </div>
      </div>
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
    <div className="flex items-baseline justify-between">
      <span className="font-mono-data text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono-data text-sm font-semibold text-foreground">
          {value}
        </span>
        {change !== undefined && (
          <span
            className={clsx(
              'font-mono-data text-[9px]',
              change >= 0 ? 'text-bullish' : 'text-bearish'
            )}
          >
            {formatPercent(change)}
          </span>
        )}
      </div>
    </div>
  );
}
