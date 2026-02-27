'use client';

import { cn } from '@/lib/utils';
import { Radio, ArrowUpRight } from 'lucide-react';
import { RankSparkline } from './rank-sparkline';

interface EmergingAlert {
  id: string;
  signal: string;
  direction: string | null;
  currentRank: number | null;
  contribution: number | null;
  contribVelocity: number | null;
  traders: number | null;
  priceChg4h: number | null;
  reasonCount: number;
  reasons: string[];
  isImmediate: boolean;
  isDeepClimber: boolean;
  erratic: boolean;
  lowVelocity: boolean;
  rankHistory: number[] | null;
  contribHistory: number[] | null;
}

interface EmergingSnapshot {
  status: string;
  hasImmediate: boolean;
  hasEmergingMover: boolean;
  hasDeepClimber: boolean;
  totalMarkets: number | null;
  scansInHistory: number | null;
}

interface Props {
  snapshot: EmergingSnapshot | null;
  alerts: EmergingAlert[];
}

export function EmergingSection({ snapshot, alerts }: Props) {
  return (
    <section>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative">
          <Radio className="w-4 h-4 text-amber-400/80" aria-hidden="true" />
          {snapshot?.hasImmediate && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-bearish animate-pulse" />
          )}
        </div>
        <h2 className="font-mono-data text-[13px] font-bold uppercase tracking-[0.14em] text-foreground/85">
          Emerging Movers
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-amber-400/30 to-transparent" aria-hidden="true" />
        <span className="font-mono-data text-[11px] font-bold tabular-nums text-amber-400/80">
          {alerts.length} alerts
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* Snapshot sidebar */}
        <div className="rounded-xl border border-border/30 bg-surface/15 p-3 space-y-3">
          <h3 className="font-mono-data text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            Scan Status
          </h3>
          {snapshot ? (
            <div className="space-y-2">
              <StatusRow label="Markets" value={String(snapshot.totalMarkets ?? '—')} />
              <StatusRow label="History" value={`${snapshot.scansInHistory ?? '—'} scans`} />
              <div className="flex gap-2 pt-1">
                <StatusDot active={snapshot.hasImmediate} label="IMM" color="bg-bearish" />
                <StatusDot active={snapshot.hasEmergingMover} label="EMG" color="bg-amber-400" />
                <StatusDot active={snapshot.hasDeepClimber} label="DEEP" color="bg-primary" />
              </div>
            </div>
          ) : (
            <p className="font-mono-data text-micro text-muted-foreground/40">No scan data</p>
          )}
        </div>

        {/* Alert cards */}
        <div className="space-y-2.5">
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-border/25 bg-surface/10 px-4 py-8 text-center">
              <p className="font-mono-data text-caption text-muted-foreground/50 uppercase tracking-wider">
                No emerging mover alerts
              </p>
            </div>
          ) : (
            alerts.map((alert) => (
              <EmergingCard key={alert.id} alert={alert} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono-data text-[10px] text-muted-foreground/65 uppercase tracking-wider">{label}</span>
      <span className="font-mono-data text-[12px] font-bold tabular-nums text-foreground/75">{value}</span>
    </div>
  );
}

function StatusDot({ active, label, color }: { active: boolean; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn('h-2 w-2 rounded-full', active ? color : 'bg-muted-foreground/20')} />
      <span className={cn('font-mono-data text-[8px] uppercase tracking-wider', active ? 'text-foreground/70' : 'text-muted-foreground/30')}>
        {label}
      </span>
    </div>
  );
}

function EmergingCard({ alert }: { alert: EmergingAlert }) {
  return (
    <a
      href="https://app.hyperliquid.xyz/trade"
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-border/35 bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-200 hover:border-primary/40 hover:bg-surface/40"
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20">
        <div className="flex items-center gap-2.5">
          <span className="font-mono-data text-[14px] font-bold text-foreground/90 tracking-tight">
            {alert.signal}
          </span>
          {alert.isImmediate && (
            <span className="rounded border border-bearish/45 bg-bearish/12 px-1.5 py-0.5 font-mono-data text-[9px] font-bold uppercase tracking-wider text-bearish">
              Immediate
            </span>
          )}
          {alert.isDeepClimber && (
            <span className="rounded border border-primary/35 bg-primary/10 px-1.5 py-0.5 font-mono-data text-[9px] font-bold uppercase tracking-wider text-primary">
              Deep Climber
            </span>
          )}
          {alert.erratic && (
            <span className="rounded border border-orange-400/30 bg-orange-400/8 px-1.5 py-0.5 font-mono-data text-[9px] font-bold uppercase tracking-wider text-orange-400/80">
              Erratic
            </span>
          )}
          {alert.lowVelocity && (
            <span className="rounded border border-muted-foreground/25 bg-surface/30 px-1.5 py-0.5 font-mono-data text-[9px] uppercase tracking-wider text-muted-foreground/60">
              Low Vel
            </span>
          )}
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
      </div>

      {/* Detail body */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {/* Rank + sparkline */}
          <div>
            <div className="font-mono-data text-[8px] uppercase tracking-wider text-muted-foreground/50 mb-1">Rank</div>
            <div className="flex items-center gap-2">
              <span className="font-mono-data text-[14px] font-bold tabular-nums text-foreground/85">
                #{alert.currentRank ?? '—'}
              </span>
              <RankSparkline data={alert.rankHistory} inverted />
            </div>
          </div>

          {/* Contribution */}
          <div>
            <div className="font-mono-data text-[8px] uppercase tracking-wider text-muted-foreground/50 mb-1">SM Profit %</div>
            <div className="flex items-center gap-2">
              <span className="font-mono-data text-[14px] font-bold tabular-nums text-foreground/85">
                {alert.contribution?.toFixed(1) ?? '—'}%
              </span>
              <RankSparkline data={alert.contribHistory} inverted={false} />
            </div>
          </div>

          {/* Velocity */}
          <div>
            <div className="font-mono-data text-[8px] uppercase tracking-wider text-muted-foreground/50 mb-1">Velocity</div>
            <span className={cn('font-mono-data text-[14px] font-bold tabular-nums',
              (alert.contribVelocity ?? 0) >= 0.05 ? 'text-bullish' : 'text-foreground/70'
            )}>
              {alert.contribVelocity?.toFixed(3) ?? '—'}
            </span>
          </div>

          {/* 4h Price Change */}
          <div>
            <div className="font-mono-data text-[8px] uppercase tracking-wider text-muted-foreground/50 mb-1">4h Chg</div>
            <span className={cn('font-mono-data text-[14px] font-bold tabular-nums',
              (alert.priceChg4h ?? 0) >= 0 ? 'text-bullish' : 'text-bearish'
            )}>
              {alert.priceChg4h !== null ? `${alert.priceChg4h >= 0 ? '+' : ''}${alert.priceChg4h.toFixed(1)}%` : '—'}
            </span>
          </div>
        </div>

        {/* Traders + Signals count */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1">
            <span className="font-mono-data text-[8px] text-muted-foreground/45 uppercase">Traders</span>
            <span className="font-mono-data text-[11px] font-bold text-foreground/70 tabular-nums">{alert.traders ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-mono-data text-[8px] text-muted-foreground/45 uppercase">Signals</span>
            <span className="font-mono-data text-[11px] font-bold text-foreground/70 tabular-nums">{alert.reasonCount}</span>
          </div>
        </div>

        {/* Full reasons list */}
        {alert.reasons.length > 0 && (
          <div>
            <div className="font-mono-data text-[8px] uppercase tracking-wider text-muted-foreground/50 mb-1.5">Reasons</div>
            <div className="flex flex-wrap gap-1">
              {alert.reasons.map((reason, i) => (
                <span key={i} className="rounded border border-border/30 bg-surface/25 px-1.5 py-0.5 font-mono-data text-[8px] text-muted-foreground/75">
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </a>
  );
}
