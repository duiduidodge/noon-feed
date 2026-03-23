import Link from 'next/link';
import { ArrowUpRight, Bot } from 'lucide-react';
import { formatCompactNumber, formatSignedUsd, formatTimeAgo } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface FleetSummary {
  totalBots: number;
  liveBots: number;
  staleBots: number;
  enabledBots: number;
  openPositions: number;
  aggregateDailyPnlUsd: number;
  aggregateEquityUsd: number;
  articleCount24h: number;
  signals: {
    opportunitiesAt: Date | null;
    emergingAt: Date | null;
    whalesAt: Date | null;
  };
}

interface FleetBot {
  id: string;
  slug: string;
  name: string;
  environment: string;
  category: string | null;
  strategyFamily: string | null;
  venue: string | null;
  status: string;
  isEnabled: boolean;
  lastHeartbeatAt: Date | null;
  freshness: 'LIVE' | 'STALE';
  latestMetric: {
    equityUsd: number | null;
    dailyPnlUsd: number | null;
    drawdownPct: number | null;
    openPositions: number | null;
    observedAt: Date;
  } | null;
  openPositions: number;
}

interface HubCommandCenterProps {
  summary: FleetSummary;
  fleet: FleetBot[];
  loadWarning?: string | null;
  events?: unknown[];
}

function freshnessGlow(freshness: 'LIVE' | 'STALE') {
  return freshness === 'LIVE' ? 'hub-bot-card-live' : 'hub-bot-card-stale';
}

function statusLabel(status: string) {
  const s = status.toUpperCase();
  if (['LIVE', 'HEALTHY', 'RUNNING'].includes(s)) return 'positive';
  if (['DEGRADED', 'STALE'].includes(s)) return 'warn';
  if (['ERROR', 'HALTED'].includes(s)) return 'danger';
  return 'neutral';
}

export function HubCommandCenter({ summary, fleet, loadWarning }: HubCommandCenterProps) {
  return (
    <div className="min-h-[100dvh]">
      <main
        id="hub-main"
        className="mx-auto flex w-full max-w-[1640px] flex-col gap-5 px-3 pb-10 pt-6 md:px-5 lg:px-6"
      >
        {loadWarning ? (
          <div className="hub-warn-banner">
            <span className="hub-warn-tag">Offline</span>
            <p>{loadWarning}</p>
          </div>
        ) : null}

        {/* Section header */}
        <div className="hub-fleet-section-header">
          <div className="flex items-center gap-3">
            <span className="hub-panel-label">Bot fleet</span>
            {summary.liveBots > 0 && (
              <span className="hub-live-count">
                <span className="hub-live-dot" />
                {summary.liveBots} live
              </span>
            )}
          </div>
          <span className="hub-panel-meta">
            {summary.enabledBots} enabled · {summary.openPositions} open positions
          </span>
        </div>

        {fleet.length === 0 ? (
          <div className="hub-empty-state">
            <Bot className="h-5 w-5" />
            <div>
              <p>No bots registered yet.</p>
              <span>Push heartbeats to <code>/hub/heartbeat</code> to register bots here.</span>
            </div>
          </div>
        ) : (
          <div className="hub-fleet-grid">
            {fleet.map((bot) => {
              const pnl = bot.latestMetric?.dailyPnlUsd ?? 0;
              const isLive = bot.freshness === 'LIVE';
              return (
                <Link
                  key={bot.id}
                  href={`/bots/${bot.slug}`}
                  className={cn('hub-bot-link-card', freshnessGlow(bot.freshness))}
                >
                  {/* Top row: status + arrow */}
                  <div className="hub-card-toprow">
                    <div className="flex items-center gap-2">
                      <span className={cn('hub-status-dot', isLive ? 'hub-status-dot-live' : 'hub-status-dot-stale')} />
                      <span className={cn('hub-card-pill', `hub-card-pill-${statusLabel(bot.freshness)}`)}>
                        {bot.freshness}
                      </span>
                      <span className={cn('hub-card-pill', `hub-card-pill-${statusLabel(bot.status)}`)}>
                        {bot.status}
                      </span>
                    </div>
                    <ArrowUpRight className="hub-card-arrow" />
                  </div>

                  {/* Bot name */}
                  <div className="hub-card-name-block">
                    <h2 className="hub-card-name">{bot.name}</h2>
                    <p className="hub-card-strategy">
                      {bot.strategyFamily ?? bot.category ?? '—'}
                      {bot.venue ? <span className="hub-card-venue"> · {bot.venue}</span> : null}
                    </p>
                  </div>

                  {/* Metrics grid */}
                  <div className="hub-card-metrics">
                    <div className="hub-card-metric">
                      <span className="hub-card-metric-label">Equity</span>
                      <strong className="hub-card-metric-value">
                        {bot.latestMetric?.equityUsd != null
                          ? formatCompactNumber(bot.latestMetric.equityUsd)
                          : '—'}
                      </strong>
                    </div>
                    <div className="hub-card-metric">
                      <span className="hub-card-metric-label">Daily PnL</span>
                      <strong className={cn(
                        'hub-card-metric-value',
                        bot.latestMetric?.dailyPnlUsd != null
                          ? pnl >= 0 ? 'text-bullish' : 'text-bearish'
                          : ''
                      )}>
                        {bot.latestMetric?.dailyPnlUsd != null
                          ? formatSignedUsd(bot.latestMetric.dailyPnlUsd)
                          : '—'}
                      </strong>
                    </div>
                    <div className="hub-card-metric">
                      <span className="hub-card-metric-label">Positions</span>
                      <strong className="hub-card-metric-value">
                        {bot.latestMetric?.openPositions ?? bot.openPositions}
                      </strong>
                    </div>
                  </div>

                  {/* Footer */}
                  <p className="hub-card-footer">
                    {bot.lastHeartbeatAt
                      ? `Heartbeat ${formatTimeAgo(bot.lastHeartbeatAt)}`
                      : 'No heartbeat yet'}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
