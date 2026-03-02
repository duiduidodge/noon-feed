'use client';

import { useEffect } from 'react';
import { X, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RankSparkline } from './rank-sparkline';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoreBreakdown {
  base: number;
  trendBonus: number;
  emergingBonus: number;
  whaleBonus: number;
}

interface OpportunityDetail {
  finalScore: number;
  scanStreak: number | null;
  hourlyTrend: string | null;
  trendAligned: boolean;
  leverage: number | null;
  pillarScores: Record<string, number> | null;
  smartMoney: Record<string, unknown> | null;
  technicals: Record<string, unknown> | null;
  funding: Record<string, unknown> | null;
  risks: string[];
}

interface EmergingDetail {
  currentRank: number | null;
  contribution: number | null;
  contribVelocity: number | null;
  priceChg4h: number | null;
  traders: number | null;
  reasons: string[];
  isImmediate: boolean;
  isDeepClimber: boolean;
  erratic: boolean;
  lowVelocity: boolean;
  rankHistory: number[] | null;
  contribHistory: number[] | null;
  reasonCount: number;
}

export interface SetupDetailItem {
  id: string;
  asset: string;
  direction: string;
  confidence: number;
  thesis: string;
  scoreBreakdown?: ScoreBreakdown;
  opportunity?: OpportunityDetail | null;
  emerging?: EmergingDetail | null;
  whaleTopScore?: number | null;
}

interface Props {
  setup: SetupDetailItem;
  onClose: () => void;
}

// ─── Plain-language helpers ───────────────────────────────────────────────────

function rsiLabel(rsi: number, direction: string): { text: string; color: string } {
  if (direction === 'LONG') {
    if (rsi < 30) return { text: 'Deeply oversold — reversal bounce expected', color: 'text-bullish' };
    if (rsi < 45) return { text: 'Mildly oversold — good long entry zone', color: 'text-bullish' };
    if (rsi < 65) return { text: 'Healthy momentum zone', color: 'text-yellow-400' };
    if (rsi < 75) return { text: 'Strong momentum — watch for pullback', color: 'text-yellow-400' };
    return { text: 'Overbought — elevated risk for longs', color: 'text-bearish' };
  } else {
    if (rsi > 75) return { text: 'Overbought — good short entry zone', color: 'text-bullish' };
    if (rsi > 60) return { text: 'Elevated — potential short setup', color: 'text-yellow-400' };
    if (rsi > 40) return { text: 'Mid-range — neutral for shorts', color: 'text-yellow-400' };
    return { text: 'Oversold — risky for shorts', color: 'text-bearish' };
  }
}

function fundingLabel(rate: number, direction: string): { text: string; color: string } {
  if (direction === 'LONG') {
    if (rate < -0.0002) return { text: 'Shorts heavily funding longs — strong carry advantage', color: 'text-bullish' };
    if (rate < 0) return { text: 'Negative funding — longs earn carry', color: 'text-bullish' };
    if (rate < 0.0003) return { text: 'Near-zero funding — negligible cost', color: 'text-yellow-400' };
    if (rate < 0.001) return { text: 'Small cost to hold long', color: 'text-yellow-400' };
    return { text: 'High funding cost — carry risk for longs', color: 'text-bearish' };
  } else {
    if (rate > 0.0002) return { text: 'Longs heavily funding shorts — strong carry advantage', color: 'text-bullish' };
    if (rate > 0) return { text: 'Positive funding — shorts earn carry', color: 'text-bullish' };
    if (rate > -0.0003) return { text: 'Near-zero funding — negligible cost', color: 'text-yellow-400' };
    return { text: 'Negative funding — carry risk for shorts', color: 'text-bearish' };
  }
}

function volumeLabel(ratio: number): { text: string; color: string } {
  if (ratio >= 3) return { text: `${ratio.toFixed(1)}× avg — strong breakout volume`, color: 'text-bullish' };
  if (ratio >= 2) return { text: `${ratio.toFixed(1)}× avg — elevated activity`, color: 'text-bullish' };
  if (ratio >= 1.3) return { text: `${ratio.toFixed(1)}× avg — above normal`, color: 'text-yellow-400' };
  if (ratio >= 0.7) return { text: `${ratio.toFixed(1)}× avg — normal volume`, color: 'text-muted-foreground/70' };
  return { text: `${ratio.toFixed(1)}× avg — below average`, color: 'text-bearish' };
}

function smLabel(pnlPct: number | undefined, accel: number | undefined): string {
  if (pnlPct === undefined) return 'Smart money positioning unavailable';
  if (pnlPct > 15) return `Smart money up ${pnlPct.toFixed(1)}% — highly profitable positioning`;
  if (pnlPct > 5) return `Smart money up ${pnlPct.toFixed(1)}% — positive conviction`;
  if (pnlPct > 0) return `Smart money slightly positive (${pnlPct.toFixed(1)}%)`;
  if (pnlPct > -5) return `Smart money slightly underwater — watch closely`;
  return `Smart money down ${Math.abs(pnlPct).toFixed(1)}% — contrarian signal`;
}

function trendLabel(trend: string | null | undefined): { text: string; color: string } {
  if (trend === 'UP') return { text: 'Uptrend confirmed on 4h (price above EMA20 & EMA50)', color: 'text-bullish' };
  if (trend === 'DOWN') return { text: 'Downtrend on 4h (price below both EMAs)', color: 'text-bearish' };
  return { text: 'No clear trend on 4h — sideways market', color: 'text-muted-foreground/60' };
}

function velocityLabel(vel: number | null): { text: string; color: string } {
  if (vel === null) return { text: '—', color: 'text-muted-foreground/50' };
  if (vel >= 0.5) return { text: 'Accelerating rapidly', color: 'text-bullish' };
  if (vel >= 0.1) return { text: 'Gaining momentum', color: 'text-bullish' };
  if (vel >= 0.01) return { text: 'Slowly building', color: 'text-yellow-400' };
  return { text: 'Low velocity', color: 'text-muted-foreground/50' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionDivider({ label, color = 'text-muted-foreground/50' }: { label: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px w-4 bg-border/30" />
      <span className={cn('font-mono-data text-[10px] font-bold uppercase tracking-[0.22em]', color)}>
        {label}
      </span>
      <div className="flex-1 h-px bg-border/20" />
    </div>
  );
}

// Confidence breakdown chip row
function ConfidenceChips({ breakdown, total }: { breakdown: ScoreBreakdown; total: number }) {
  const chips = [
    { label: 'BASE', value: breakdown.base, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/25' },
    { label: 'TREND', value: breakdown.trendBonus, color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/25' },
    { label: 'EMERGING', value: breakdown.emergingBonus, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/25' },
    { label: 'WHALE', value: breakdown.whaleBonus, color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/25' },
  ];

  return (
    <div className="space-y-4">
      {/* Score chips */}
      <div className="grid grid-cols-4 gap-2">
        {chips.map((chip) => (
          <div
            key={chip.label}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border py-3 px-2',
              chip.bg, chip.border,
              chip.value === 0 && 'opacity-35'
            )}
          >
            <span className={cn('font-mono-data text-[10px] font-bold uppercase tracking-[0.15em]', chip.color)}>
              {chip.label}
            </span>
            <span className={cn('font-mono-data text-[22px] font-bold tabular-nums leading-none', chip.color)}>
              {chip.value > 0 && chip.label !== 'BASE' ? `+${chip.value}` : chip.value}
            </span>
          </div>
        ))}
      </div>

      {/* Summary bar */}
      <div className="space-y-2">
        <div className="flex h-1.5 rounded-full overflow-hidden bg-surface/40 border border-border/20">
          <div className="bg-primary/70 transition-all duration-500" style={{ width: `${(breakdown.base / 99) * 100}%` }} />
          <div className="bg-cyan-400/70 transition-all duration-500" style={{ width: `${(breakdown.trendBonus / 99) * 100}%` }} />
          <div className="bg-amber-400/70 transition-all duration-500" style={{ width: `${(breakdown.emergingBonus / 99) * 100}%` }} />
          <div className="bg-violet-400/70 transition-all duration-500" style={{ width: `${(breakdown.whaleBonus / 99) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono-data text-[11px] text-muted-foreground/50 uppercase tracking-wider">Total Score</span>
          <span className="font-mono-data text-[16px] font-bold text-foreground/90 tabular-nums">{total} / 99</span>
        </div>
      </div>
    </div>
  );
}

// Inline pillar score row (replaces PillarBar)
function PillarRow({
  label,
  score,
  color,
  barColor,
  max = 100,
}: {
  label: string;
  score: number;
  color: string;
  barColor: string;
  max?: number;
}) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;

  return (
    <div className="flex items-center gap-3">
      <span className={cn('font-mono-data text-[11px] font-bold uppercase tracking-wider w-32 shrink-0', color)}>
        {label}
      </span>
      <div className="flex-1 flex items-center gap-0.5">
        {Array.from({ length: filled }).map((_, i) => (
          <div key={`f-${i}`} className={cn('h-2 flex-1 rounded-sm', barColor)} />
        ))}
        {Array.from({ length: empty }).map((_, i) => (
          <div key={`e-${i}`} className="h-2 flex-1 rounded-sm bg-surface/50 border border-border/20" />
        ))}
      </div>
      <span className="font-mono-data text-[16px] font-bold tabular-nums text-foreground/85 w-8 text-right">
        {score}
      </span>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function SetupDetailModal({ setup, onClose }: Props) {
  const isLong = setup.direction === 'LONG';
  const opp = setup.opportunity ?? null;
  const emg = setup.emerging ?? null;
  const tech = opp?.technicals as Record<string, unknown> | null ?? null;
  const funding = opp?.funding as Record<string, unknown> | null ?? null;
  const sm = opp?.smartMoney as Record<string, unknown> | null ?? null;

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const rsi1h = tech?.rsi1h as number | undefined;
  const volRatio = tech?.volRatio1h as number | undefined;
  const trend4h = tech?.trend4h as string | undefined;
  const fundingRate = funding?.rate as number | undefined;
  const annualized = funding?.annualized as number | undefined;
  const favorable = funding?.favorable as boolean | undefined;
  const pnlPct = sm?.pnlPct as number | undefined;
  const accel = sm?.accel as number | undefined;
  const chg1h = tech?.chg1h as number | undefined;
  const chg4h = tech?.chg4h as number | undefined;

  const hasTrend = trend4h !== undefined;
  const trendInfo = trendLabel(trend4h);
  const rsiInfo = rsi1h !== undefined ? rsiLabel(rsi1h, setup.direction) : null;
  const volInfo = volRatio !== undefined ? volumeLabel(volRatio) : null;
  const fundInfo = fundingRate !== undefined ? fundingLabel(fundingRate, setup.direction) : null;

  const pillarScores = opp?.pillarScores as { smartMoney?: number; marketStructure?: number; technicals?: number; funding?: number } | null ?? null;

  const DirectionIcon = isLong ? TrendingUp : TrendingDown;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-border/40 bg-card shadow-modal overflow-hidden animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className={cn(
          'flex items-center gap-4 px-6 py-4 border-b border-border/25',
          isLong ? 'bg-bullish/5' : 'bg-bearish/5'
        )}>
          {/* Direction accent bar */}
          <div className={cn('w-1 self-stretch rounded-full', isLong ? 'bg-bullish' : 'bg-bearish')} />

          {/* Asset name */}
          <div className="flex flex-col gap-0.5">
            <span className="font-mono-data text-3xl font-bold text-foreground/95 tracking-tight leading-none">
              {setup.asset}
            </span>
            <span className="font-mono-data text-[11px] text-muted-foreground/50 uppercase tracking-wider">
              Perpetual Future
            </span>
          </div>

          {/* Direction badge */}
          <span className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1 font-mono-data text-sm font-bold uppercase tracking-wider',
            isLong
              ? 'border-bullish/45 bg-bullish/12 text-bullish'
              : 'border-bearish/45 bg-bearish/12 text-bearish'
          )}>
            <DirectionIcon className="h-3.5 w-3.5" />
            {setup.direction}
          </span>

          {/* Confidence */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground/45">Score</span>
            <span className={cn(
              'font-mono-data text-2xl font-bold tabular-nums leading-none',
              setup.confidence >= 80 ? 'text-bullish' : 'text-primary'
            )}>
              {setup.confidence}
            </span>
          </div>

          {/* Leverage */}
          {opp?.leverage && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground/45">Lev</span>
              <span className="font-mono-data text-sm font-bold text-muted-foreground/70">
                {opp.leverage}×
              </span>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="ml-auto rounded-lg border border-border/30 bg-surface/20 p-2 text-muted-foreground/50 hover:border-border/60 hover:text-foreground/80 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto custom-scrollbar max-h-[85vh] px-6 py-5 space-y-6">

          {/* Thesis */}
          <p className="font-mono-data text-[13px] text-muted-foreground/75 leading-relaxed border-l-2 border-primary/30 pl-4">
            {setup.thesis}
          </p>

          {/* ── Confidence Breakdown ── */}
          {setup.scoreBreakdown && (
            <div>
              <SectionDivider label="Confidence Breakdown" color="text-primary/80" />
              <ConfidenceChips breakdown={setup.scoreBreakdown} total={setup.confidence} />

              {/* Reading notes */}
              {(setup.scoreBreakdown.trendBonus > 0 ||
                setup.scoreBreakdown.emergingBonus > 0 ||
                setup.scoreBreakdown.whaleBonus > 0) && (
                <div className="mt-4 space-y-2">
                  {setup.scoreBreakdown.trendBonus > 0 && (
                    <ReadingRow icon="✓" text="4h trend aligns with direction — reduces false signal risk" />
                  )}
                  {setup.scoreBreakdown.emergingBonus >= 10 && (
                    <ReadingRow icon="⚡" text="Immediate mover detected — active trader accumulation right now" />
                  )}
                  {setup.scoreBreakdown.emergingBonus === 6 && (
                    <ReadingRow icon="↑" text="Deep climber confirmed — sustained ranking improvement" />
                  )}
                  {setup.scoreBreakdown.emergingBonus === 3 && (
                    <ReadingRow icon="~" text="Some emerging activity — mild trader interest" />
                  )}
                  {setup.scoreBreakdown.whaleBonus > 0 && (
                    <ReadingRow icon="🐋" text="Whale backdrop active — top wallet scoring ≥ 80" />
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Opportunity Scanner ── */}
          {opp && (
            <div>
              <SectionDivider label="Opportunity Scanner" color="text-cyan-400/80" />
              <div className="space-y-5">

                {/* Quick stats row */}
                <div className="grid grid-cols-4 gap-2">
                  <QuickStat
                    label="Scan Streak"
                    value={`×${opp.scanStreak ?? 0}`}
                    valueClass="text-foreground/85"
                  />
                  <QuickStat
                    label="Hourly Trend"
                    value={opp.hourlyTrend ?? '—'}
                    valueClass={
                      opp.hourlyTrend === 'UP' ? 'text-bullish'
                      : opp.hourlyTrend === 'DOWN' ? 'text-bearish'
                      : 'text-muted-foreground/60'
                    }
                  />
                  {chg1h !== undefined && (
                    <QuickStat
                      label="1h Change"
                      value={`${chg1h >= 0 ? '+' : ''}${chg1h.toFixed(1)}%`}
                      valueClass={chg1h >= 0 ? 'text-bullish' : 'text-bearish'}
                    />
                  )}
                  {chg4h !== undefined && (
                    <QuickStat
                      label="4h Change"
                      value={`${chg4h >= 0 ? '+' : ''}${chg4h.toFixed(1)}%`}
                      valueClass={chg4h >= 0 ? 'text-bullish' : 'text-bearish'}
                    />
                  )}
                  {opp.trendAligned && (
                    <QuickStat
                      label="Alignment"
                      value="Aligned"
                      valueClass="text-bullish"
                    />
                  )}
                </div>

                {/* 4-Pillar scores */}
                {pillarScores && (
                  <div className="rounded-xl border border-border/25 bg-surface/20 px-4 py-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-muted-foreground/45">
                        4-Pillar Score
                      </span>
                      <span className="font-mono-data text-[14px] font-bold text-foreground/80 tabular-nums">
                        {opp.finalScore} total
                      </span>
                    </div>
                    {pillarScores.smartMoney !== undefined && (
                      <PillarRow
                        label="Smart Money"
                        score={pillarScores.smartMoney}
                        color="text-cyan-400"
                        barColor="bg-cyan-400/70"
                      />
                    )}
                    {pillarScores.marketStructure !== undefined && (
                      <PillarRow
                        label="Mkt Structure"
                        score={pillarScores.marketStructure}
                        color="text-primary"
                        barColor="bg-primary/70"
                      />
                    )}
                    {pillarScores.technicals !== undefined && (
                      <PillarRow
                        label="Technicals"
                        score={pillarScores.technicals}
                        color="text-amber-400"
                        barColor="bg-amber-400/70"
                      />
                    )}
                    {pillarScores.funding !== undefined && (
                      <PillarRow
                        label="Funding"
                        score={pillarScores.funding}
                        color="text-violet-400"
                        barColor="bg-violet-400/70"
                      />
                    )}
                  </div>
                )}

                {/* Signal readings */}
                <div className="space-y-2">
                  {hasTrend && (
                    <SignalReading
                      label="Market Structure"
                      value={trend4h ?? '—'}
                      valueClass={trendInfo.color}
                      description={trendInfo.text}
                    />
                  )}
                  {rsiInfo && rsi1h !== undefined && (
                    <SignalReading
                      label="RSI 1h"
                      value={rsi1h.toFixed(1)}
                      valueClass={rsiInfo.color}
                      description={rsiInfo.text}
                    />
                  )}
                  {volInfo && (
                    <SignalReading
                      label="Volume"
                      value={`${volRatio!.toFixed(1)}×`}
                      valueClass={volInfo.color}
                      description={volInfo.text}
                    />
                  )}
                  {sm && (
                    <SignalReading
                      label="Smart Money"
                      value={`SM ${((opp.pillarScores as Record<string, number> | null)?.smartMoney ?? 0)}`}
                      valueClass="text-cyan-400"
                      description={smLabel(pnlPct, accel)}
                      sub={accel !== undefined ? `Acceleration: ${accel.toFixed(2)}` : undefined}
                    />
                  )}
                  {fundInfo && fundingRate !== undefined && (
                    <SignalReading
                      label="Funding Rate"
                      value={`${(fundingRate * 100).toFixed(4)}%`}
                      valueClass={favorable ? 'text-bullish' : fundingRate > 0.001 ? 'text-bearish' : 'text-yellow-400'}
                      description={fundInfo.text}
                      sub={annualized !== undefined ? `${annualized.toFixed(1)}% annualized` : undefined}
                    />
                  )}
                </div>

                {/* Risks */}
                {opp.risks.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground/45">Risks</span>
                    {opp.risks.map((r, i) => (
                      <span key={i} className="rounded-md border border-bearish/30 bg-bearish/8 px-2.5 py-1 font-mono-data text-[11px] text-bearish/80">
                        {r.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Emerging Movers ── */}
          {emg && (
            <div>
              <SectionDivider label="Emerging Movers" color="text-amber-400/80" />
              <div className="space-y-4">

                {/* Type badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {emg.isImmediate && (
                    <span className="rounded-lg border border-bearish/45 bg-bearish/10 px-3 py-1.5 font-mono-data text-xs font-bold uppercase tracking-wider text-bearish">
                      Immediate
                    </span>
                  )}
                  {emg.isDeepClimber && (
                    <span className="rounded-lg border border-primary/40 bg-primary/8 px-3 py-1.5 font-mono-data text-xs font-bold uppercase tracking-wider text-primary">
                      Deep Climber
                    </span>
                  )}
                  {emg.erratic && (
                    <span className="rounded-lg border border-orange-400/40 bg-orange-400/8 px-3 py-1.5 font-mono-data text-xs uppercase tracking-wider text-orange-400/85">
                      Erratic
                    </span>
                  )}
                  {emg.lowVelocity && (
                    <span className="rounded-lg border border-muted-foreground/25 bg-surface/20 px-3 py-1.5 font-mono-data text-xs uppercase tracking-wider text-muted-foreground/55">
                      Low Velocity
                    </span>
                  )}
                </div>

                {/* Key stats */}
                <div className="grid grid-cols-2 gap-3">
                  {emg.currentRank !== null && (
                    <div className="rounded-xl border border-border/25 bg-surface/20 px-4 py-3">
                      <div className="font-mono-data text-[11px] uppercase tracking-wider text-muted-foreground/45 mb-1">
                        Rank
                      </div>
                      <div className="flex items-end gap-3">
                        <span className="font-mono-data text-2xl font-bold text-foreground/90 tabular-nums leading-none">
                          #{emg.currentRank}
                        </span>
                        <div className="mb-0.5">
                          <RankSparkline data={emg.rankHistory} inverted />
                        </div>
                      </div>
                    </div>
                  )}
                  {emg.contribution !== null && (
                    <div className="rounded-xl border border-border/25 bg-surface/20 px-4 py-3">
                      <div className="font-mono-data text-[11px] uppercase tracking-wider text-muted-foreground/45 mb-1">
                        SM Contribution
                      </div>
                      <div className="flex items-end gap-3">
                        <span className="font-mono-data text-2xl font-bold text-foreground/90 tabular-nums leading-none">
                          {emg.contribution.toFixed(1)}%
                        </span>
                        <div className="mb-0.5">
                          <RankSparkline data={emg.contribHistory} inverted={false} />
                        </div>
                      </div>
                    </div>
                  )}
                  {emg.contribVelocity !== null && (
                    <div className="rounded-xl border border-border/25 bg-surface/20 px-4 py-3">
                      <div className="font-mono-data text-[11px] uppercase tracking-wider text-muted-foreground/45 mb-1">
                        Velocity
                      </div>
                      <span className={cn(
                        'font-mono-data text-xl font-bold tabular-nums leading-none',
                        velocityLabel(emg.contribVelocity).color
                      )}>
                        {emg.contribVelocity.toFixed(3)}
                      </span>
                      <div className={cn('font-mono-data text-[11px] mt-1', velocityLabel(emg.contribVelocity).color)}>
                        {velocityLabel(emg.contribVelocity).text}
                      </div>
                    </div>
                  )}
                  {emg.priceChg4h !== null && (
                    <div className="rounded-xl border border-border/25 bg-surface/20 px-4 py-3">
                      <div className="font-mono-data text-[11px] uppercase tracking-wider text-muted-foreground/45 mb-1">
                        4h Price
                      </div>
                      <span className={cn(
                        'font-mono-data text-xl font-bold tabular-nums leading-none',
                        emg.priceChg4h >= 0 ? 'text-bullish' : 'text-bearish'
                      )}>
                        {emg.priceChg4h >= 0 ? '+' : ''}{emg.priceChg4h.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {emg.traders !== null && (
                    <div className="rounded-xl border border-border/25 bg-surface/20 px-4 py-3">
                      <div className="font-mono-data text-[11px] uppercase tracking-wider text-muted-foreground/45 mb-1">
                        Active Traders
                      </div>
                      <span className="font-mono-data text-xl font-bold tabular-nums text-foreground/85 leading-none">
                        {emg.traders}
                      </span>
                    </div>
                  )}
                </div>

                {/* Velocity momentum reading */}
                {emg.contribVelocity !== null && (
                  <SignalReading
                    label="Momentum"
                    value={velocityLabel(emg.contribVelocity).text.split(' — ')[0]}
                    valueClass={velocityLabel(emg.contribVelocity).color}
                    description={
                      emg.isImmediate
                        ? 'Active trader accumulation happening right now — highest priority signal'
                        : emg.isDeepClimber
                        ? 'Consistent rank improvement over multiple scans — sustained interest'
                        : 'Gradual rank improvement — early-stage signal'
                    }
                  />
                )}

                {/* Reason tags */}
                {emg.reasons.length > 0 && (
                  <div>
                    <div className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground/45 mb-2.5">
                      Signal Reasons
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {emg.reasons.map((r, i) => (
                        <span
                          key={i}
                          className="rounded-lg border border-amber-400/25 bg-amber-400/7 px-3 py-1.5 font-mono-data text-xs text-amber-400/80"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Whale Backdrop ── */}
          {setup.whaleTopScore !== null && setup.whaleTopScore !== undefined && (
            <div>
              <SectionDivider label="Whale Backdrop" color="text-violet-400/80" />
              <SignalReading
                label="Top Whale Score"
                value={setup.whaleTopScore.toFixed(1)}
                valueClass={
                  setup.whaleTopScore >= 80 ? 'text-bullish'
                  : setup.whaleTopScore >= 60 ? 'text-yellow-400'
                  : 'text-muted-foreground/60'
                }
                description={
                  setup.whaleTopScore >= 80
                    ? 'High-performing whale active — strong market confidence signal'
                    : setup.whaleTopScore >= 60
                    ? 'Moderate whale activity — mild backdrop confirmation'
                    : 'Low whale activity — no strong backdrop signal'
                }
              />
            </div>
          )}

          {/* ── Price context fallback (no opportunity) ── */}
          {!opp && emg?.priceChg4h !== null && emg?.priceChg4h !== undefined && (
            <div>
              <SectionDivider label="Price Context" />
              <QuickStat
                label="4h Change"
                value={`${emg.priceChg4h >= 0 ? '+' : ''}${emg.priceChg4h.toFixed(1)}%`}
                valueClass={emg.priceChg4h >= 0 ? 'text-bullish' : 'text-bearish'}
              />
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="flex items-center gap-3 border-t border-border/25 bg-surface/10 px-6 py-4">
          <a
            href="https://app.hyperliquid.xyz/trade"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-2 font-mono-data text-[12px] font-bold uppercase tracking-wider transition-colors',
              isLong
                ? 'border-bullish/40 bg-bullish/10 text-bullish hover:bg-bullish/20'
                : 'border-bearish/40 bg-bearish/10 text-bearish hover:bg-bearish/20'
            )}
          >
            Trade on Hyperliquid
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <span className="ml-auto font-mono-data text-[10px] text-muted-foreground/35 uppercase tracking-wider">
            Not financial advice
          </span>
          <button
            onClick={onClose}
            className="rounded-lg border border-border/30 bg-surface/15 px-4 py-2 font-mono-data text-[12px] text-muted-foreground/60 hover:text-foreground/80 hover:border-border/50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Signal reading row (2-column layout) ─────────────────────────────────────

function SignalReading({
  label,
  value,
  valueClass,
  description,
  sub,
}: {
  label: string;
  value: string;
  valueClass?: string;
  description: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border/20 bg-surface/15 px-4 py-3">
      {/* Left: label + value */}
      <div className="shrink-0 w-28">
        <div className="font-mono-data text-[11px] uppercase tracking-wider text-muted-foreground/45 mb-1">
          {label}
        </div>
        <div className={cn('font-mono-data text-[18px] font-bold tabular-nums leading-none', valueClass || 'text-foreground/85')}>
          {value}
        </div>
        {sub && (
          <div className="font-mono-data text-[10px] text-muted-foreground/40 mt-1.5 leading-snug">
            {sub}
          </div>
        )}
      </div>
      {/* Right: explanation */}
      <div className="flex-1 pt-0.5">
        <p className="font-mono-data text-[13px] text-muted-foreground/70 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

// ─── Quick stat tile ──────────────────────────────────────────────────────────

function QuickStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/20 bg-surface/20 px-4 py-3">
      <span className="font-mono-data text-[11px] uppercase tracking-wider text-muted-foreground/45">
        {label}
      </span>
      <span className={cn('font-mono-data text-[14px] font-bold tabular-nums', valueClass || 'text-foreground/80')}>
        {value}
      </span>
    </div>
  );
}

// ─── Reading row (confidence notes) ──────────────────────────────────────────

function ReadingRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-surface/15 px-3 py-2">
      <span className="shrink-0 text-[13px] mt-0.5">{icon}</span>
      <p className="font-mono-data text-[12px] text-muted-foreground/65 leading-relaxed">{text}</p>
    </div>
  );
}
