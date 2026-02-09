'use client';

import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCompactNumber, formatPercent } from '@/lib/utils';

interface GlobalStats {
  totalMcap: number;
  totalVolume: number;
  btcDominance: number;
  avgChange24h: number;
}

export function MarketTicker() {
  const { data } = useQuery({
    queryKey: ['prices'],
    queryFn: async () => {
      const res = await fetch('/api/prices');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 60_000,
    select: (data) => data.global as GlobalStats,
  });

  if (!data) return null;

  return (
    <div className="flex items-center gap-3 font-mono-data text-[11px]">
      <StatItem label="MCap" value={formatCompactNumber(data.totalMcap)} />
      <Separator />
      <StatItem label="Vol" value={formatCompactNumber(data.totalVolume)} />
      <Separator />
      <div className="hidden items-center gap-1.5 sm:flex">
        <StatItem label="BTC" value={`${data.btcDominance.toFixed(1)}%`} />
        <Separator />
      </div>
      <div
        className={clsx(
          'flex items-center gap-1 font-medium',
          data.avgChange24h >= 0 ? 'text-bullish' : 'text-bearish'
        )}
      >
        {data.avgChange24h >= 0 ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        <span>24h {formatPercent(data.avgChange24h)}</span>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground/60">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function Separator() {
  return <span className="text-border">|</span>;
}
