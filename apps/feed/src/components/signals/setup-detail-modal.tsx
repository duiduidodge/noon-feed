'use client';

import { useEffect } from 'react';
import { X, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PillarBar } from './pillar-bar';
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

function SectionHeader({ label, color = 'text-muted-foreground/50' }: { label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={cn('font-mono-data text-[8px] font-bold uppercase tracking-[0.2em]', color)}>
        {label}
      </span>
      <div className="flex-1 h-px bg-border/20" />
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono-data text-[7px] uppercase tracking-wider text-muted-foreground/40">{label}</span>
      <span className={cn('font-mono-data text-[11px] font-bold tabular-nums', valueClass || 'text-foreground/80')}>
        {value}
      </span>
    </div>
  );
}

function ConfidenceBar({ breakdown, total }: { breakdown: ScoreBreakdown; total: number }) {
  const segments = [
    { label: 'Base', value: breakdown.base, color: 'bg-primary/70' },
    { label: 'Trend', value: breakdown.trendBonus, color: 'bg-cyan-400/70' },
    { label: 'Emerging', value: breakdown.emergingBonus, color: 'bg-amber-400/70' },
    { label: 'Whale', value: breakdown.whaleBonus, color: 'bg-violet-400/70' },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-2">
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-surface/30 border border-border/20">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={cn(seg.color, 'transition-all duration-500')}
            style={{ width: `${(seg.value / 99) * 100}%` }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1">
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', seg.color)} />
            <span className="font-mono-data text-[8px] text-muted-foreground/55 uppercase tracking-wider">
              {seg.label}
            </span>
            <span className="font-mono-data text-[9px] font-bold text-foreground/70 tabular-nums">
              +{seg.value}
            </span>
          </div>
        ))}
        <span className="ml-auto font-mono-data text-[11px] font-bold text-foreground/85 tabular-nums">
          {total} / 99
        </span>
      </div>
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
  const chg24h = tech?.chg24h as number | undefined;

  const hasTrend = trend4h !== undefined;
  const trendInfo = trendLabel(trend4h);
  const rsiInfo = rsi1h !== undefined ? rsiLabel(rsi1h, setup.direction) : null;
  const volInfo = volRatio !== undefined ? volumeLabel(volRatio) : null;
  const fundInfo = fundingRate !== undefined ? fundingLabel(fundingRate, setup.direction) : null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border/40 bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 border-b border-border/25',
          isLong ? 'bg-bullish/6' : 'bg-bearish/6'
        )}>
          <span className="font-mono-data text-[18px] font-bold text-foreground/95 tracking-tight">
            {setup.asset}
          </span>
          <span className={cn(
            'rounded border px-2 py-0.5 font-mono-data text-[9px] font-bold uppercase tracking-wider',
            isLong ? 'border-bullish/45 bg-bullish/12 text-bullish' : 'border-bearish/45 bg-bearish/12 text-bearish'
          )}>
            {setup.direction}
          </span>
          <span className={cn(
            'rounded border px-2 py-0.5 font-mono-data text-[11px] font-bold tabular-nums',
            setup.confidence >= 80
              ? 'border-bullish/40 bg-bullish/10 text-bullish'
              : 'border-primary/35 bg-primary/8 text-primary'
          )}>
            {setup.confidence}
          </span>
          {opp?.leverage && (
            <span className="rounded border border-border/30 bg-surface/20 px-1.5 py-0.5 font-mono-data text-[8px] text-muted-foreground/60">
              {opp.leverage}x
            </span>
          )}
          <button
            onClick={onClose}
            className="ml-auto rounded-lg border border-border/25 bg-surface/20 p-1.5 text-muted-foreground/50 hover:border-border/50 hover:text-foreground/70 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto custom-scrollbar max-h-[70vh] p-4 space-y-5">

          {/* Thesis */}
          <p className="font-mono-data text-[11px] text-muted-foreground/70 leading-relaxed">
            {setup.thesis}
          </p>

          {/* ── Confidence breakdown ── */}
          {setup.scoreBreakdown && (
            <div>
              <SectionHeader label="Confidence Breakdown" color="text-primary/70" />
              <ConfidenceBar breakdown={setup.scoreBreakdown} total={setup.confidence} />
              <div className="mt-2 space-y-1">
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
            </div>
          )}

          {/* ── Opportunity signal ── */}
          {opp && (
            <div>
              <SectionHeader label="Opportunity Scanner" color="text-cyan-400/70" />
              <div className="space-y-3">

                {/* Pillar bar */}
                <div>
                  <div className="font-mono-data text-[7px] uppercase tracking-[0.18em] text-muted-foreground/40 mb-2">
                    4-Pillar Score — {opp.finalScore} total
                  </div>
                  <PillarBar scores={opp.pillarScores as { smartMoney?: number; marketStructure?: number; technicals?: number; funding?: number } | null} />
                </div>

                {/* Quick stats row */}
                <div className="flex gap-4">
                  <Stat label="Scan Streak" value={`×${opp.scanStreak ?? 0}`} />
                  <Stat label="Hourly" value={opp.hourlyTrend ?? '—'} valueClass={
                    opp.hourlyTrend === 'UP' ? 'text-bullish' : opp.hourlyTrend === 'DOWN' ? 'text-bearish' : 'text-muted-foreground/60'
                  } />
                  {opp.trendAligned && (
                    <Stat label="Alignment" value="✓ Aligned" valueClass="text-bullish" />
                  )}
                  {chg1h !== undefined && (
                    <Stat
                      label="1h Change"
                      value={`${chg1h >= 0 ? '+' : ''}${chg1h.toFixed(1)}%`}
                      valueClass={chg1h >= 0 ? 'text-bullish' : 'text-bearish'}
                    />
                  )}
                  {chg4h !== undefined && (
                    <Stat
                      label="4h Change"
                      value={`${chg4h >= 0 ? '+' : ''}${chg4h.toFixed(1)}%`}
                      valueClass={chg4h >= 0 ? 'text-bullish' : 'text-bearish'}
                    />
                  )}
                </div>

                {/* 4h trend reading */}
                {hasTrend && (
                  <SignalReading
                    label="Market Structure"
                    value={trend4h ?? '—'}
                    valueClass={trendInfo.color}
                    description={trendInfo.text}
                  />
                )}

                {/* RSI reading */}
                {rsiInfo && rsi1h !== undefined && (
                  <SignalReading
                    label="RSI 1h"
                    value={rsi1h.toFixed(1)}
                    valueClass={rsiInfo.color}
                    description={rsiInfo.text}
                  />
                )}

                {/* Volume reading */}
                {volInfo && (
                  <SignalReading
                    label="Volume"
                    value={`${volRatio!.toFixed(1)}×`}
                    valueClass={volInfo.color}
                    description={volInfo.text}
                  />
                )}

                {/* Smart money reading */}
                {sm && (
                  <SignalReading
                    label="Smart Money"
                    value={`SM ${((opp.pillarScores as Record<string, number> | null)?.smartMoney ?? 0)}`}
                    valueClass="text-cyan-400"
                    description={smLabel(pnlPct, accel)}
                    sub={accel !== undefined ? `Acceleration: ${accel.toFixed(2)}` : undefined}
                  />
                )}

                {/* Funding reading */}
                {fundInfo && fundingRate !== undefined && (
                  <SignalReading
                    label="Funding Rate"
                    value={`${(fundingRate * 100).toFixed(4)}%`}
                    valueClass={favorable ? 'text-bullish' : fundingRate > 0.001 ? 'text-bearish' : 'text-yellow-400'}
                    description={fundInfo.text}
                    sub={annualized !== undefined ? `${annualized.toFixed(1)}% annualized` : undefined}
                  />
                )}

                {/* Risks */}
                {opp.risks.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="font-mono-data text-[7px] uppercase tracking-wider text-muted-foreground/40">Risks</span>
                    {opp.risks.map((r, i) => (
                      <span key={i} className="rounded border border-bearish/25 bg-bearish/8 px-1.5 py-0.5 font-mono-data text-[8px] text-bearish/80">
                        {r.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Emerging signal ── */}
          {emg && (
            <div>
              <SectionHeader label="Emerging Movers" color="text-amber-400/70" />
              <div className="space-y-3">

                {/* Type badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {emg.isImmediate && (
                    <span className="rounded border border-bearish/40 bg-bearish/10 px-2 py-0.5 font-mono-data text-[8px] font-bold uppercase tracking-wider text-bearish">
                      Immediate
                    </span>
                  )}
                  {emg.isDeepClimber && (
                    <span className="rounded border border-primary/35 bg-primary/8 px-2 py-0.5 font-mono-data text-[8px] font-bold uppercase tracking-wider text-primary">
                      Deep Climber
                    </span>
                  )}
                  {emg.erratic && (
                    <span className="rounded border border-orange-400/35 bg-orange-400/8 px-2 py-0.5 font-mono-data text-[8px] uppercase tracking-wider text-orange-400/80">
                      Erratic
                    </span>
                  )}
                  {emg.lowVelocity && (
                    <span className="rounded border border-muted-foreground/20 bg-surface/20 px-2 py-0.5 font-mono-data text-[8px] uppercase tracking-wider text-muted-foreground/50">
                      Low Velocity
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex gap-4 flex-wrap">
                  {emg.currentRank !== null && (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono-data text-[7px] uppercase tracking-wider text-muted-foreground/40">Rank</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-data text-[11px] font-bold text-foreground/80">#{emg.currentRank}</span>
                        <RankSparkline data={emg.rankHistory} inverted />
                      </div>
                    </div>
                  )}
                  {emg.contribution !== null && (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono-data text-[7px] uppercase tracking-wider text-muted-foreground/40">SM Contribution</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-data text-[11px] font-bold text-foreground/80">{emg.contribution.toFixed(1)}%</span>
                        <RankSparkline data={emg.contribHistory} inverted={false} />
                      </div>
                    </div>
                  )}
                  {emg.contribVelocity !== null && (
                    <Stat
                      label="Velocity"
                      value={emg.contribVelocity.toFixed(3)}
                      valueClass={velocityLabel(emg.contribVelocity).color}
                    />
                  )}
                  {emg.priceChg4h !== null && (
                    <Stat
                      label="4h Price"
                      value={`${emg.priceChg4h >= 0 ? '+' : ''}${emg.priceChg4h.toFixed(1)}%`}
                      valueClass={emg.priceChg4h >= 0 ? 'text-bullish' : 'text-bearish'}
                    />
                  )}
                  {emg.traders !== null && (
                    <Stat label="Traders" value={String(emg.traders)} />
                  )}
                </div>

                {/* Velocity reading */}
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

                {/* Reasons */}
                {emg.reasons.length > 0 && (
                  <div>
                    <div className="font-mono-data text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-2">
                      Signal Reasons
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {emg.reasons.map((r, i) => (
                        <span
                          key={i}
                          className="rounded border border-amber-400/20 bg-amber-400/6 px-1.5 py-0.5 font-mono-data text-[8px] text-amber-400/75"
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

          {/* ── Whale backdrop ── */}
          {setup.whaleTopScore !== null && setup.whaleTopScore !== undefined && (
            <div>
              <SectionHeader label="Whale Backdrop" color="text-violet-400/70" />
              <SignalReading
                label="Top Whale Score"
                value={setup.whaleTopScore.toFixed(1)}
                valueClass={setup.whaleTopScore >= 80 ? 'text-bullish' : setup.whaleTopScore >= 60 ? 'text-yellow-400' : 'text-muted-foreground/60'}
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

          {/* ── Price changes summary (if opportunity missing but we have 24h) ── */}
          {!opp && emg?.priceChg4h !== null && emg?.priceChg4h !== undefined && (
            <div>
              <SectionHeader label="Price Context" />
              <div className="flex gap-4">
                <Stat
                  label="4h Change"
                  value={`${emg.priceChg4h >= 0 ? '+' : ''}${emg.priceChg4h.toFixed(1)}%`}
                  valueClass={emg.priceChg4h >= 0 ? 'text-bullish' : 'text-bearish'}
                />
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="flex items-center gap-2 border-t border-border/25 bg-surface/10 px-4 py-3">
          <a
            href="https://app.hyperliquid.xyz/trade"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono-data text-[10px] font-bold uppercase tracking-wider transition-colors',
              isLong
                ? 'border-bullish/40 bg-bullish/10 text-bullish hover:bg-bullish/20'
                : 'border-bearish/40 bg-bearish/10 text-bearish hover:bg-bearish/20'
            )}
          >
            Trade on Hyperliquid
            <ExternalLink className="h-3 w-3" />
          </a>
          <span className="ml-auto font-mono-data text-[8px] text-muted-foreground/35 uppercase tracking-wider">
            Not financial advice
          </span>
          <button
            onClick={onClose}
            className="rounded-lg border border-border/25 bg-surface/15 px-3 py-1.5 font-mono-data text-[10px] text-muted-foreground/60 hover:text-foreground/70 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Signal reading row ───────────────────────────────────────────────────────

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
    <div className="flex items-start gap-3 rounded-lg border border-border/20 bg-surface/12 px-3 py-2">
      <div className="shrink-0 w-20">
        <div className="font-mono-data text-[7px] uppercase tracking-wider text-muted-foreground/40 mb-0.5">{label}</div>
        <div className={cn('font-mono-data text-[12px] font-bold tabular-nums', valueClass || 'text-foreground/80')}>
          {value}
        </div>
        {sub && (
          <div className="font-mono-data text-[7px] text-muted-foreground/40 mt-0.5">{sub}</div>
        )}
      </div>
      <p className="font-mono-data text-[10px] text-muted-foreground/65 leading-relaxed pt-0.5">
        {description}
      </p>
    </div>
  );
}

function ReadingRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 text-[10px] mt-0.5">{icon}</span>
      <p className="font-mono-data text-[10px] text-muted-foreground/60 leading-relaxed">{text}</p>
    </div>
  );
}
