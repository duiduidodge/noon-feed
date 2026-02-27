'use client';

import { cn } from '@/lib/utils';
import { Target, ArrowUpRight } from 'lucide-react';
import { PillarBar } from './pillar-bar';
import { TechnicalsGrid } from './technicals-grid';

interface OpportunityItem {
  id: string;
  asset: string;
  direction: string | null;
  leverage: number | null;
  finalScore: number | null;
  scoreDelta: number | null;
  scanStreak: number | null;
  hourlyTrend: string | null;
  trendAligned: boolean;
  risks: string[];
  pillarScores: Record<string, unknown> | null;
  smartMoney: Record<string, unknown> | null;
  technicals: Record<string, unknown> | null;
  funding: Record<string, unknown> | null;
}

interface OpportunitySnapshot {
  assetsScanned: number | null;
  passedStage1: number | null;
  passedStage2: number | null;
  deepDived: number | null;
  disqualified: number | null;
  btcContext: Record<string, unknown> | null;
}

interface Props {
  snapshot: OpportunitySnapshot | null;
  items: OpportunityItem[];
}

export function OpportunitySection({ snapshot, items }: Props) {
  return (
    <section>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-cyan-400/80" aria-hidden="true" />
        <h2 className="font-mono-data text-[13px] font-bold uppercase tracking-[0.14em] text-foreground/85">
          Opportunity Scanner
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-cyan-400/30 to-transparent" aria-hidden="true" />
        <span className="font-mono-data text-[11px] font-bold tabular-nums text-cyan-400/80">
          {items.length} active
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* Funnel sidebar */}
        <div className="rounded-xl border border-border/30 bg-surface/15 p-3 space-y-3">
          <h3 className="font-mono-data text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            Scan Funnel
          </h3>
          {snapshot ? (
            <div className="space-y-2">
              <FunnelRow label="Scanned" value={snapshot.assetsScanned} />
              <FunnelRow label="Stage 1" value={snapshot.passedStage1} />
              <FunnelRow label="Stage 2" value={snapshot.passedStage2} />
              <FunnelRow label="Deep Dived" value={snapshot.deepDived} />
              <FunnelRow label="Disqualified" value={snapshot.disqualified} accent="text-bearish/70" />
            </div>
          ) : (
            <p className="font-mono-data text-micro text-muted-foreground/40">No scan data</p>
          )}
        </div>

        {/* Opportunity cards */}
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="rounded-xl border border-border/25 bg-surface/10 px-4 py-8 text-center">
              <p className="font-mono-data text-caption text-muted-foreground/50 uppercase tracking-wider">
                No active opportunities
              </p>
            </div>
          ) : (
            items.map((item) => (
              <OpportunityCard key={item.id} item={item} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function FunnelRow({ label, value, accent }: { label: string; value: number | null; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono-data text-[10px] text-muted-foreground/65 uppercase tracking-wider">{label}</span>
      <span className={cn('font-mono-data text-[12px] font-bold tabular-nums', accent || 'text-foreground/75')}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function OpportunityCard({ item }: { item: OpportunityItem }) {
  const score = item.finalScore ?? 0;
  const isHigh = score >= 220;
  const sm = item.smartMoney as Record<string, number> | null;
  const funding = item.funding as Record<string, unknown> | null;

  return (
    <a
      href="https://app.hyperliquid.xyz/trade"
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-border/35 bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-200 hover:border-primary/40 hover:bg-surface/40"
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <div className="flex items-center gap-3">
          <span className="font-mono-data text-[15px] font-bold text-foreground/90 tracking-tight">
            {item.asset}
          </span>
          <span className={cn(
            'rounded border px-2 py-0.5 font-mono-data text-[10px] font-bold uppercase tracking-wider',
            item.direction === 'LONG' ? 'border-bullish/40 bg-bullish/10 text-bullish' : 'border-bearish/40 bg-bearish/10 text-bearish'
          )}>
            {item.direction ?? '—'}
          </span>
          <span className={cn(
            'rounded border px-2 py-0.5 font-mono-data text-[11px] font-bold tabular-nums',
            isHigh ? 'border-bullish/45 bg-bullish/12 text-bullish' : 'border-primary/35 bg-primary/10 text-primary'
          )}>
            {score}
          </span>
          {item.leverage && (
            <span className="rounded border border-border/30 bg-surface/25 px-1.5 py-0.5 font-mono-data text-[9px] font-bold text-muted-foreground/70">
              {item.leverage}x
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono-data text-[10px] text-muted-foreground/60 tabular-nums">
            <span>streak {item.scanStreak ?? 0}</span>
            <span>Δ{item.scoreDelta ?? 0}</span>
            <span className={cn(
              'uppercase font-bold',
              item.hourlyTrend === 'UP' ? 'text-bullish' : item.hourlyTrend === 'DOWN' ? 'text-bearish' : ''
            )}>
              {item.hourlyTrend ?? '—'}
            </span>
            {item.trendAligned && (
              <span className="text-bullish font-bold">✓aligned</span>
            )}
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
        </div>
      </div>

      {/* Detail body */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 py-3">
        {/* Left: Pillar breakdown + SM data */}
        <div className="space-y-3">
          <div>
            <h4 className="font-mono-data text-[8px] uppercase tracking-[0.18em] text-muted-foreground/50 mb-2">Pillar Scores</h4>
            <PillarBar scores={item.pillarScores as { smartMoney?: number; marketStructure?: number; technicals?: number; funding?: number } | null} />
          </div>

          {sm && (
            <div>
              <h4 className="font-mono-data text-[8px] uppercase tracking-[0.18em] text-muted-foreground/50 mb-1.5">Smart Money</h4>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {sm.traders !== undefined && <SmStat label="Traders" value={String(sm.traders)} />}
                {sm.pnlPct !== undefined && <SmStat label="PnL" value={`${sm.pnlPct?.toFixed(1)}%`} />}
                {sm.accel !== undefined && <SmStat label="Accel" value={sm.accel?.toFixed(2)} />}
                {sm.direction && <SmStat label="Dir" value={String(sm.direction)} />}
              </div>
            </div>
          )}

          {funding && (
            <div>
              <h4 className="font-mono-data text-[8px] uppercase tracking-[0.18em] text-muted-foreground/50 mb-1.5">Funding</h4>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {funding.rate !== undefined && <SmStat label="Rate" value={`${(Number(funding.rate) * 100).toFixed(4)}%`} />}
                {funding.annualized !== undefined && <SmStat label="Ann" value={`${Number(funding.annualized).toFixed(1)}%`} />}
                {funding.favorable !== undefined && (
                  <span className={cn('font-mono-data text-[9px] font-bold uppercase', funding.favorable ? 'text-bullish' : 'text-bearish')}>
                    {funding.favorable ? 'Favorable' : 'Unfavorable'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Risks */}
          {item.risks.length > 0 && (
            <div>
              <h4 className="font-mono-data text-[8px] uppercase tracking-[0.18em] text-muted-foreground/50 mb-1.5">Risks</h4>
              <div className="flex flex-wrap gap-1">
                {item.risks.map((risk, i) => (
                  <span key={i} className="rounded border border-bearish/25 bg-bearish/8 px-1.5 py-0.5 font-mono-data text-[8px] text-bearish/80">
                    {risk}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Technicals */}
        <div>
          <h4 className="font-mono-data text-[8px] uppercase tracking-[0.18em] text-muted-foreground/50 mb-2">Technicals</h4>
          <TechnicalsGrid data={item.technicals as Parameters<typeof TechnicalsGrid>[0]['data']} />
        </div>
      </div>
    </a>
  );
}

function SmStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono-data text-[8px] text-muted-foreground/45 uppercase">{label}</span>
      <span className="font-mono-data text-[10px] font-bold text-foreground/70 tabular-nums">{value}</span>
    </div>
  );
}
