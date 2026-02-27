'use client';

import { cn } from '@/lib/utils';
import { Waves } from 'lucide-react';

interface WhaleTrader {
  id: string;
  walletAddress: string;
  score: number | null;
  rank: number | null;
  consistency: string | null;
  riskLabel: string | null;
  pnlRank: string | null;
  winRate: number | null;
  holdTimeHours: number | null;
  maxDrawdownPct: number | null;
  allocationPct: number | null;
  overlapRiskPct: number | null;
}

interface WhaleSnapshot {
  timeframe: string;
  candidates: number | null;
  selectedCount: number | null;
}

interface Props {
  snapshot: WhaleSnapshot | null;
  traders: WhaleTrader[];
}

function shortWallet(wallet: string): string {
  if (wallet.length < 12) return wallet;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-bullish';
  if (score >= 60) return 'text-yellow-400';
  return 'text-bearish';
}

const CONSISTENCY_COLORS: Record<string, string> = {
  ELITE: 'border-amber-400/40 bg-amber-400/10 text-amber-400',
  RELIABLE: 'border-bullish/35 bg-bullish/10 text-bullish',
  BALANCED: 'border-primary/35 bg-primary/10 text-primary',
  STREAKY: 'border-orange-400/35 bg-orange-400/10 text-orange-400',
};

export function WhaleSection({ snapshot, traders }: Props) {
  return (
    <section>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <Waves className="w-4 h-4 text-violet-400/80" aria-hidden="true" />
        <h2 className="font-mono-data text-[13px] font-bold uppercase tracking-[0.14em] text-foreground/85">
          Whale Index
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-violet-400/30 to-transparent" aria-hidden="true" />
        <span className="font-mono-data text-[11px] font-bold tabular-nums text-violet-400/80">
          {traders.length} tracked
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* Snapshot sidebar */}
        <div className="rounded-xl border border-border/30 bg-surface/15 p-3 space-y-2">
          <h3 className="font-mono-data text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            Scan Meta
          </h3>
          {snapshot ? (
            <>
              <MetaRow label="Candidates" value={String(snapshot.candidates ?? '—')} />
              <MetaRow label="Selected" value={String(snapshot.selectedCount ?? '—')} />
              <MetaRow label="Timeframe" value={snapshot.timeframe} />
            </>
          ) : (
            <p className="font-mono-data text-micro text-muted-foreground/40">No scan data</p>
          )}
        </div>

        {/* Whale table */}
        <div className="rounded-xl border border-border/30 bg-surface/10 overflow-hidden overflow-x-auto">
          {traders.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="font-mono-data text-caption text-muted-foreground/50 uppercase tracking-wider">
                No whale data available
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/25 bg-surface/20">
                  {['Wallet', 'Score', 'Win%', 'Rank', 'Hold', 'DD%', 'Overlap', 'Alloc', 'Risk', 'Style'].map((h) => (
                    <th key={h} className="px-3 py-2 font-mono-data text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {traders.map((trader, idx) => (
                  <tr
                    key={trader.id}
                    className={cn(
                      'border-b border-border/10 transition-colors hover:bg-surface/30',
                      idx % 2 === 0 ? 'bg-surface/8' : 'bg-transparent'
                    )}
                  >
                    <td className="px-3 py-2 font-mono-data text-[11px] font-bold text-foreground/80 tracking-tight">
                      {shortWallet(trader.walletAddress)}
                    </td>
                    <td className={cn('px-3 py-2 font-mono-data text-[12px] font-bold tabular-nums', trader.score !== null ? scoreColor(trader.score) : 'text-muted-foreground/30')}>
                      {trader.score?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-3 py-2 font-mono-data text-[11px] tabular-nums text-foreground/70">
                      {trader.winRate?.toFixed(1) ?? '—'}%
                    </td>
                    <td className="px-3 py-2 font-mono-data text-[11px] tabular-nums text-foreground/70">
                      #{trader.rank ?? '—'}
                    </td>
                    <td className="px-3 py-2 font-mono-data text-[11px] tabular-nums text-foreground/70">
                      {trader.holdTimeHours?.toFixed(1) ?? '—'}h
                    </td>
                    <td className={cn('px-3 py-2 font-mono-data text-[11px] tabular-nums', (trader.maxDrawdownPct ?? 0) > 15 ? 'text-bearish' : 'text-foreground/70')}>
                      {trader.maxDrawdownPct?.toFixed(1) ?? '—'}%
                    </td>
                    <td className={cn('px-3 py-2 font-mono-data text-[11px] tabular-nums', (trader.overlapRiskPct ?? 0) > 50 ? 'text-orange-400' : 'text-foreground/70')}>
                      {trader.overlapRiskPct?.toFixed(1) ?? '—'}%
                    </td>
                    <td className="px-3 py-2 font-mono-data text-[11px] tabular-nums text-foreground/70">
                      {trader.allocationPct?.toFixed(1) ?? '—'}%
                    </td>
                    <td className="px-3 py-2">
                      {trader.riskLabel ? (
                        <span className="rounded border border-border/30 bg-surface/25 px-1.5 py-0.5 font-mono-data text-[8px] uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap">
                          {trader.riskLabel}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {trader.consistency ? (
                        <span className={cn('rounded border px-1.5 py-0.5 font-mono-data text-[8px] font-bold uppercase tracking-wider whitespace-nowrap',
                          CONSISTENCY_COLORS[trader.consistency] || 'border-border/30 bg-surface/25 text-muted-foreground/60'
                        )}>
                          {trader.consistency}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono-data text-[10px] text-muted-foreground/65 uppercase tracking-wider">{label}</span>
      <span className="font-mono-data text-[12px] font-bold tabular-nums text-foreground/75">{value}</span>
    </div>
  );
}
