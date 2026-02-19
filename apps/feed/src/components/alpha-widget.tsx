'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import Image from 'next/image';

interface AlphaItem {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap: number;
  rank: number;
  volumeToMcap?: number;
}

interface AlphaData {
  gainers: AlphaItem[];
  losers: AlphaItem[];
  volumeSurge: AlphaItem[];
  asOf: string | null;
}

async function fetchAlpha(): Promise<AlphaData> {
  const res = await fetch('/api/alpha');
  if (!res.ok) throw new Error('Failed to fetch alpha data');
  return res.json();
}

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toFixed(6);
}



// Export raw data tools for other components if needed
export { fetchAlpha };
export type { AlphaData, AlphaItem };

// ─── Sub-components ───

function MoverRow({
  item,
  showVol = false,
  maxAbsChange,
  compact = false,
}: {
  item: AlphaItem;
  showVol?: boolean;
  maxAbsChange: number;
  compact?: boolean;
}) {
  const positive = item.change24h >= 0;
  const barWidth = Math.min(100, (Math.abs(item.change24h) / maxAbsChange) * 100);
  const volCapPct = item.volumeToMcap != null ? `${(item.volumeToMcap * 100).toFixed(0)}%` : '';

  if (compact) {
    return (
      <div className="group relative grid grid-cols-[14px_1fr_46px] items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors cursor-default">
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity',
            positive ? 'bg-bullish/5' : 'bg-bearish/5'
          )}
          style={{ width: `${barWidth}%` }}
        />

        {/* Icon */}
        <div className="relative z-10 shrink-0 w-3.5 h-3.5 rounded-full overflow-hidden bg-muted/30">
          {item.image ? (
            <Image src={item.image} alt={item.symbol} width={14} height={14} className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[7px] font-bold text-muted-foreground">
              {item.symbol.slice(0, 2)}
            </div>
          )}
        </div>

        {/* Symbol + vol/cap */}
        <div className="relative z-10 flex items-baseline gap-1 min-w-0">
          <span className="text-[10px] font-bold text-foreground font-mono-data shrink-0">
            {item.symbol}
          </span>
          {showVol && volCapPct && (
            <span className="text-[8px] text-muted-foreground/50 font-mono-data">
              v/c {volCapPct}
            </span>
          )}
        </div>

        {/* Change % */}
        <div
          className={cn(
            'relative z-10 text-[9px] font-bold font-mono-data tabular-nums text-right',
            positive ? 'text-bullish' : 'text-bearish'
          )}
        >
          {positive ? '+' : ''}{item.change24h.toFixed(1)}%
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex h-[34px] items-center gap-2 rounded-lg px-2 hover:bg-white/5 transition-colors cursor-default">
      <div
        className={cn(
          'absolute inset-y-0 left-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity',
          positive ? 'bg-bullish/5' : 'bg-bearish/5'
        )}
        style={{ width: `${barWidth}%` }}
      />

      {/* Image or Avatar */}
      <div className="relative z-10 shrink-0 w-[18px] h-[18px] rounded-full overflow-hidden bg-muted/30">
        {item.image ? (
          <Image src={item.image} alt={item.symbol} width={18} height={18} className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[7px] font-bold text-muted-foreground">
            {item.symbol.slice(0, 2)}
          </div>
        )}
      </div>

      <div className="relative z-10 flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-foreground font-mono-data">
            {item.symbol}
          </span>
          <span className="text-[9px] text-muted-foreground/50 truncate hidden xl:block">
            {item.name}
          </span>
        </div>
        {showVol && item.volumeToMcap != null && (
          <div className="text-[8px] text-muted-foreground/40 font-mono-data">
            v/c {volCapPct}
          </div>
        )}
      </div>

      <div className="relative z-10 text-[10px] font-mono-data text-muted-foreground/70 text-right hidden sm:block">
        ${fmtPrice(item.price)}
      </div>

      <div
        className={cn(
          'relative z-10 shrink-0 text-[10px] font-bold font-mono-data tabular-nums text-right min-w-[52px]',
          positive ? 'text-bullish' : 'text-bearish'
        )}
      >
        {positive ? '+' : ''}{item.change24h.toFixed(1)}%
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  items,
  showVol = false,
  accent,
  compact = false,
}: {
  title: string;
  icon: React.ElementType;
  items: AlphaItem[];
  showVol?: boolean;
  accent: 'bullish' | 'bearish' | 'primary';
  compact?: boolean;
}) {
  const maxAbsChange = Math.max(...items.map((i) => Math.abs(i.change24h)), 1);

  const accentCls = {
    bullish: 'text-bullish border-bullish/30 bg-bullish/10',
    bearish: 'text-bearish border-bearish/30 bg-bearish/10',
    primary: 'text-primary border-primary/30 bg-primary/10',
  }[accent];

  return (
    <div className="mb-0.5">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <div className={cn('flex items-center gap-1 rounded px-1.5 py-0.5 border text-[9px] font-bold uppercase tracking-widest', accentCls)}>
          <Icon className="w-2.5 h-2.5" />
          {title}
        </div>
        <div className="flex-1 h-px bg-border/20" />
      </div>

      <div>
        {items.map((item) => (
          <MoverRow key={item.id} item={item} showVol={showVol} maxAbsChange={maxAbsChange} compact={compact} />
        ))}
      </div>
    </div>
  );
}

// ─── Volume Surge Widget (Left Column) ───
export function VolumeSurgeWidget() {
  const { data, isLoading, isError } = useQuery<AlphaData>({
    queryKey: ['alpha'],
    queryFn: fetchAlpha,
    refetchInterval: 60_000,
  });

  if (isLoading || isError || !data) return <div className="h-40 animate-pulse bg-muted/10 rounded-xl" />;

  const items = data.volumeSurge.slice(0, 5);
  const maxAbsChange = Math.max(...items.map((i) => Math.abs(i.change24h)), 1);

  return (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="flex items-center gap-1 px-1">
        <div className="p-0.5 rounded bg-primary/10 border border-primary/20">
          <Zap className="h-2.5 w-2.5 text-primary fill-primary/20 animate-pulse" />
        </div>
        <h3 className="font-display text-[9px] font-bold uppercase tracking-widest text-primary/90">
          Vol Surge
        </h3>
      </div>
      <div className="space-y-0.5 p-1 rounded-xl bg-primary/5 border border-primary/10 backdrop-blur-sm overflow-hidden">
        {items.map((item) => (
          <MoverRow key={item.id} item={item} showVol compact maxAbsChange={maxAbsChange} />
        ))}
      </div>
    </div>
  );
}

// ─── Gainers & Losers Widget (Side-by-Side) ───
export function GainersLosersWidget() {
  const { data, isLoading } = useQuery<AlphaData>({
    queryKey: ['alpha'],
    queryFn: fetchAlpha,
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return <div className="h-40 animate-pulse bg-muted/10 rounded-xl" />;
  }

  return (
    <div className="grid grid-cols-2 gap-2 h-full min-h-0">
      {/* Gainers Col */}
      <div className="flex flex-col min-h-0 bg-surface/20 rounded-xl border border-border/30 overflow-hidden">
        <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
          <Section title="Gainers" icon={TrendingUp} items={data.gainers} accent="bullish" compact />
        </div>
      </div>

      {/* Losers Col */}
      <div className="flex flex-col min-h-0 bg-surface/20 rounded-xl border border-border/30 overflow-hidden">
        <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
          <Section title="Losers" icon={TrendingDown} items={data.losers} accent="bearish" compact />
        </div>
      </div>
    </div>
  );
}

// Legacy export (deprecating usage)
export function AlphaWidget() {
  return <VolumeSurgeWidget />;
}
