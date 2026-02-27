'use client';

import { cn } from '@/lib/utils';

interface TechnicalsData {
  rsi1h?: number;
  rsi15m?: number;
  volRatio1h?: number;
  volRatio15m?: number;
  trend4h?: string;
  trendStrength?: number;
  patterns15m?: string[];
  patterns1h?: string[];
  momentum15m?: number;
  divergence?: string;
  chg1h?: number;
  chg4h?: number;
  chg24h?: number;
  support?: number;
  resistance?: number;
  atrPct?: number;
}

function rsiColor(val: number): string {
  if (val <= 30) return 'text-bearish';
  if (val >= 70) return 'text-bullish';
  return 'text-yellow-400';
}

function formatPct(val: number | undefined): string {
  if (val === undefined || val === null) return '—';
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
}

function formatPrice(val: number | undefined): string {
  if (val === undefined || val === null) return '—';
  if (val >= 1000) return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  return `$${val.toFixed(4)}`;
}

export function TechnicalsGrid({ data }: { data: TechnicalsData | null }) {
  if (!data) {
    return (
      <div className="rounded-lg border border-border/20 bg-surface/15 px-3 py-2">
        <span className="font-mono-data text-micro text-muted-foreground/40">No technicals data</span>
      </div>
    );
  }

  const patterns = [...(data.patterns1h ?? []), ...(data.patterns15m ?? [])].filter(Boolean);

  return (
    <div className="space-y-2">
      {/* Main grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {/* RSI 1h */}
        <div className="rounded-lg border border-border/25 bg-surface/15 px-2 py-1.5">
          <div className="font-mono-data text-[7px] uppercase tracking-wider text-muted-foreground/50 mb-0.5">RSI 1h</div>
          <div className={cn('font-mono-data text-[13px] font-bold tabular-nums', data.rsi1h !== undefined ? rsiColor(data.rsi1h) : 'text-muted-foreground/30')}>
            {data.rsi1h?.toFixed(1) ?? '—'}
          </div>
        </div>

        {/* RSI 15m */}
        <div className="rounded-lg border border-border/25 bg-surface/15 px-2 py-1.5">
          <div className="font-mono-data text-[7px] uppercase tracking-wider text-muted-foreground/50 mb-0.5">RSI 15m</div>
          <div className={cn('font-mono-data text-[13px] font-bold tabular-nums', data.rsi15m !== undefined ? rsiColor(data.rsi15m) : 'text-muted-foreground/30')}>
            {data.rsi15m?.toFixed(1) ?? '—'}
          </div>
        </div>

        {/* Vol Ratio */}
        <div className="rounded-lg border border-border/25 bg-surface/15 px-2 py-1.5">
          <div className="font-mono-data text-[7px] uppercase tracking-wider text-muted-foreground/50 mb-0.5">Vol 1h</div>
          <div className={cn('font-mono-data text-[13px] font-bold tabular-nums', (data.volRatio1h ?? 0) >= 2 ? 'text-bullish' : 'text-foreground/70')}>
            {data.volRatio1h?.toFixed(1) ?? '—'}x
          </div>
        </div>

        {/* 4h Trend */}
        <div className="rounded-lg border border-border/25 bg-surface/15 px-2 py-1.5">
          <div className="font-mono-data text-[7px] uppercase tracking-wider text-muted-foreground/50 mb-0.5">4h Trend</div>
          <div className={cn('font-mono-data text-[11px] font-bold uppercase',
            data.trend4h === 'UP' ? 'text-bullish' : data.trend4h === 'DOWN' ? 'text-bearish' : 'text-muted-foreground/60'
          )}>
            {data.trend4h ?? '—'}
          </div>
        </div>

        {/* Momentum */}
        <div className="rounded-lg border border-border/25 bg-surface/15 px-2 py-1.5">
          <div className="font-mono-data text-[7px] uppercase tracking-wider text-muted-foreground/50 mb-0.5">Mom 15m</div>
          <div className={cn('font-mono-data text-[11px] font-bold tabular-nums', (data.momentum15m ?? 0) >= 0 ? 'text-bullish' : 'text-bearish')}>
            {formatPct(data.momentum15m)}
          </div>
        </div>

        {/* ATR */}
        <div className="rounded-lg border border-border/25 bg-surface/15 px-2 py-1.5">
          <div className="font-mono-data text-[7px] uppercase tracking-wider text-muted-foreground/50 mb-0.5">ATR %</div>
          <div className="font-mono-data text-[11px] font-bold tabular-nums text-foreground/70">
            {data.atrPct?.toFixed(2) ?? '—'}%
          </div>
        </div>
      </div>

      {/* Price changes row */}
      <div className="flex gap-3 px-1">
        {[
          { label: '1h', val: data.chg1h },
          { label: '4h', val: data.chg4h },
          { label: '24h', val: data.chg24h },
        ].map(({ label, val }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="font-mono-data text-[8px] text-muted-foreground/50 uppercase">{label}</span>
            <span className={cn('font-mono-data text-[10px] font-bold tabular-nums', (val ?? 0) >= 0 ? 'text-bullish' : 'text-bearish')}>
              {formatPct(val)}
            </span>
          </div>
        ))}
      </div>

      {/* S/R line */}
      {(data.support || data.resistance) && (
        <div className="flex items-center gap-2 px-1">
          <span className="font-mono-data text-[8px] text-muted-foreground/50 uppercase">S/R</span>
          <span className="font-mono-data text-[10px] text-bearish/80 tabular-nums">{formatPrice(data.support)}</span>
          <span className="text-muted-foreground/30">—</span>
          <span className="font-mono-data text-[10px] text-bullish/80 tabular-nums">{formatPrice(data.resistance)}</span>
        </div>
      )}

      {/* Patterns */}
      {patterns.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {patterns.slice(0, 4).map((p, i) => (
            <span key={i} className="rounded border border-border/30 bg-surface/25 px-1.5 py-0.5 font-mono-data text-[8px] uppercase tracking-wider text-muted-foreground/70">
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
