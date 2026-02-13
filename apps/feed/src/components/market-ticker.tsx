'use client';

import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { formatCompactNumber, formatPercent, formatPrice } from '@/lib/utils';
import { Globe, BarChart2, PieChart } from 'lucide-react';
import Image from 'next/image';

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

interface GlobalStats {
  totalMcap: number;
  totalVolume: number;
  btcDominance: number;
  avgChange24h: number;
}

interface PricesData {
  prices: CoinPrice[];
  global: GlobalStats;
}

// Stablecoins to exclude from the ticker
const STABLECOIN_IDS = new Set([
  'tether', 'usd-coin', 'dai', 'first-digital-usd',
  'binance-peg-busd', 'frax', 'true-usd', 'paxos-standard',
  'usdd', 'ethena-usde', 'paypal-usd',
]);
const STABLECOIN_SYMBOLS = new Set(['USDT', 'USDC', 'DAI', 'FDUSD', 'BUSD', 'FRAX', 'TUSD', 'USDP', 'USDD', 'USDE', 'PYUSD']);

export function MarketTicker() {
  const { data } = useQuery({
    queryKey: ['prices'],
    queryFn: async () => {
      const res = await fetch('/api/prices');
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<PricesData>;
    },
    refetchInterval: 60_000,
  });

  if (!data) return null;

  // Get top 10 non-stablecoin tokens by market cap
  const top10 = data.prices
    .filter((c) => !STABLECOIN_IDS.has(c.id) && !STABLECOIN_SYMBOLS.has(c.symbol))
    .sort((a, b) => b.marketCapUsd - a.marketCapUsd)
    .slice(0, 10);

  const isPositive = data.global.avgChange24h >= 0;

  const tickerContent = (
    <div className="flex items-center gap-5 px-4 whitespace-nowrap">
      {/* 24h change */}
      <span
        className={clsx(
          'font-mono-data text-[11px] font-medium',
          isPositive ? 'text-bullish' : 'text-bearish'
        )}
      >
        24h {formatPercent(data.global.avgChange24h)}
      </span>

      {/* Total Market Cap with icon */}
      <span className="flex items-center gap-1.5 font-mono-data text-[11px]">
        <Globe className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        <span className="text-muted-foreground/70">Mcap</span>
        <span className="font-medium text-foreground">{formatCompactNumber(data.global.totalMcap)}</span>
      </span>

      {/* Total Volume with icon */}
      <span className="flex items-center gap-1.5 font-mono-data text-[11px]">
        <BarChart2 className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        <span className="text-muted-foreground/70">Vol</span>
        <span className="font-medium text-foreground">{formatCompactNumber(data.global.totalVolume)}</span>
      </span>

      {/* BTC Dominance with PieChart icon — "Dom" label to avoid confusion with BTC price */}
      <span className="flex items-center gap-1.5 font-mono-data text-[11px]">
        <PieChart className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        <span className="text-muted-foreground/70">Dom</span>
        <span className="font-medium text-foreground">{data.global.btcDominance.toFixed(1)}%</span>
      </span>

      {/* Separator */}
      <span className="h-3 w-px bg-border/40" />

      {/* Top 10 token prices with logos */}
      {top10.map((coin) => {
        const coinPositive = coin.changePercent24Hr >= 0;
        return (
          <span key={coin.id} className="inline-flex items-center gap-1.5 font-mono-data text-[11px]">
            {coin.image ? (
              <Image
                src={coin.image}
                alt={coin.symbol}
                width={14}
                height={14}
                className="h-3.5 w-3.5 rounded-full shrink-0"
              />
            ) : (
              <span className="h-3.5 w-3.5 rounded-full bg-surface shrink-0 flex items-center justify-center text-[7px] text-muted-foreground">
                {coin.symbol[0]}
              </span>
            )}
            <span className="font-medium text-foreground">{coin.symbol}</span>
            <span className="text-muted-foreground/70">{formatPrice(coin.priceUsd)}</span>
            <span className={clsx(
              'font-medium min-w-[52px] text-right',
              coinPositive ? 'text-bullish' : 'text-bearish'
            )}>
              {formatPercent(coin.changePercent24Hr)}
            </span>
          </span>
        );
      })}
    </div>
  );

  return (
    <div className="relative flex overflow-hidden py-1.5">
      <div className="animate-scroll-ticker flex shrink-0">
        {tickerContent}
        {tickerContent}
      </div>
    </div>
  );
}
