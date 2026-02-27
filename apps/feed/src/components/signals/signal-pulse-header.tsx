'use client';

import { cn } from '@/lib/utils';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';

interface BtcContext {
  trend?: string;
  strength?: number;
  chg1h?: number;
  macroModifier?: number;
}

interface PulseHeaderProps {
  oppScanTime: string | null;
  emergingScanTime: string | null;
  whaleScanTime: string | null;
  btcContext: BtcContext | null;
  oppCount: number;
  emergingCount: number;
  whaleCount: number;
  hasImmediate: boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function SignalPulseHeader({
  oppScanTime,
  emergingScanTime,
  whaleScanTime,
  btcContext,
  oppCount,
  emergingCount,
  whaleCount,
  hasImmediate,
}: PulseHeaderProps) {
  const btcTrend = btcContext?.trend;
  const btcChg = btcContext?.chg1h;

  return (
    <div className="rounded-xl border border-border/35 bg-card/80 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 px-4 py-3">
        {/* Status beacon */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="w-4 h-4 text-primary/80" />
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full',
                hasImmediate ? 'bg-bearish animate-pulse' : 'bg-bullish'
              )}
            />
          </div>
          <span className="font-mono-data text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/85">
            Signal Command
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-border/30" aria-hidden="true" />

        {/* Counts */}
        <div className="flex items-center gap-3">
          <CountBadge label="OPP" count={oppCount} color="text-cyan-400" />
          <CountBadge label="EMG" count={emergingCount} color="text-amber-400" />
          <CountBadge label="WHL" count={whaleCount} color="text-violet-400" />
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-border/30" aria-hidden="true" />

        {/* BTC Context */}
        {btcContext && (
          <div className="flex items-center gap-2">
            <span className="font-mono-data text-[8px] uppercase tracking-wider text-muted-foreground/50">BTC</span>
            <span className={cn(
              'font-mono-data text-[11px] font-bold uppercase',
              btcTrend === 'UP' || btcTrend === 'strong_up' ? 'text-bullish' :
              btcTrend === 'DOWN' || btcTrend === 'strong_down' ? 'text-bearish' :
              'text-muted-foreground/60'
            )}>
              {btcTrend ?? '—'}
            </span>
            {btcChg !== undefined && btcChg !== null && (
              <span className={cn('font-mono-data text-[10px] font-semibold tabular-nums flex items-center gap-0.5',
                btcChg >= 0 ? 'text-bullish' : 'text-bearish'
              )}>
                {btcChg >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {btcChg >= 0 ? '+' : ''}{btcChg.toFixed(2)}%
              </span>
            )}
          </div>
        )}

        {/* Scan times */}
        <div className="ml-auto flex items-center gap-3">
          {oppScanTime && (
            <ScanTime label="OPP" time={formatTime(oppScanTime)} />
          )}
          {emergingScanTime && (
            <ScanTime label="EMG" time={formatTime(emergingScanTime)} />
          )}
          {whaleScanTime && (
            <ScanTime label="WHL" time={formatTime(whaleScanTime)} />
          )}
        </div>
      </div>
    </div>
  );
}

function CountBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('font-mono-data text-[9px] font-bold uppercase tracking-wider', color)}>{label}</span>
      <span className="font-mono-data text-[12px] font-bold tabular-nums text-foreground/85">{count}</span>
    </div>
  );
}

function ScanTime({ label, time }: { label: string; time: string }) {
  return (
    <span className="font-mono-data text-[9px] text-muted-foreground/50 tabular-nums">
      {label} {time}
    </span>
  );
}
