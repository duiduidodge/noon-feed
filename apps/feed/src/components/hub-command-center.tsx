import Link from 'next/link';
import { Activity, ArrowRight, Bot, Newspaper, Radar, ShieldAlert, Sparkles, Wallet } from 'lucide-react';
import { PanelShell } from '@/components/panel-shell';
import { formatCompactNumber, formatDecimal, formatSignedUsd, formatTimeAgo } from '@/lib/utils';
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

interface FleetEvent {
  id: string;
  botSlug: string;
  botName: string;
  eventType: string;
  severity: string;
  title: string;
  body: string | null;
  symbol: string | null;
  eventAt: Date;
}

interface HubCommandCenterProps {
  summary: FleetSummary;
  fleet: FleetBot[];
  events: FleetEvent[];
}

const MODULE_LINKS = [
  { href: '/signals', label: 'Signal grid', note: 'Opportunity, emerging, whale, and setup intelligence.' },
  { href: '/charts', label: 'Live charts', note: 'Shared chart outlet for discretionary review and bot context.' },
  { href: '/feed', label: 'News feed', note: 'Editorial intelligence remains part of the hub, not a separate product.' },
  { href: '/briefing', label: 'Briefings', note: 'Morning and evening market narrative for the wider system.' },
];

function statusTone(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'LIVE' || normalized === 'HEALTHY' || normalized === 'RUNNING') return 'text-bullish border-bullish/35 bg-bullish/10';
  if (normalized === 'DEGRADED' || normalized === 'STALE') return 'text-amber-500 border-amber-400/35 bg-amber-400/10';
  if (normalized === 'ERROR' || normalized === 'HALTED') return 'text-bearish border-bearish/35 bg-bearish/10';
  return 'text-muted-foreground border-border/40 bg-surface/50';
}

export function HubCommandCenter({ summary, fleet, events }: HubCommandCenterProps) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <main id="hub-main" className="mx-auto flex w-full max-w-[1640px] flex-col gap-4 px-3 pb-5 pt-3 md:px-5 md:pb-6 lg:px-6">
        <section className="hub-hero-grid">
          <div className="hub-hero-copy">
            <p className="hub-kicker">
              <Sparkles className="h-3.5 w-3.5" />
              Noon Hub
            </p>
            <h1 className="hub-title">One command surface for every bot, every signal, every market pulse.</h1>
            <p className="hub-subtitle">
              Noon Feed is now the operating layer. News stays here, but the front door is fleet status, shared charts,
              ingestion pipelines, and the health of your strategy stack.
            </p>
            <div className="hub-actions">
              <Link href="/signals" className="hub-primary-link">
                Open signal grid
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/feed" className="hub-secondary-link">
                View news module
              </Link>
            </div>
          </div>

          <PanelShell variant="primary" className="hub-hero-panel">
            <div className="hub-panel-header">
              <span className="hub-panel-label">Fleet pulse</span>
              <span className="hub-panel-meta">{summary.liveBots}/{summary.totalBots} live</span>
            </div>
            <div className="hub-metric-stage">
              <div>
                <p className="hub-metric-label">Aggregate equity</p>
                <p className="hub-metric-value">{formatCompactNumber(summary.aggregateEquityUsd || 0)}</p>
              </div>
              <div className={cn('hub-metric-delta', summary.aggregateDailyPnlUsd >= 0 ? 'text-bullish' : 'text-bearish')}>
                {formatSignedUsd(summary.aggregateDailyPnlUsd || 0)} today
              </div>
            </div>
            <div className="hub-signal-rail">
              <div>
                <span>Opportunities</span>
                <strong>{summary.signals.opportunitiesAt ? formatTimeAgo(summary.signals.opportunitiesAt) : 'No scan yet'}</strong>
              </div>
              <div>
                <span>Emerging movers</span>
                <strong>{summary.signals.emergingAt ? formatTimeAgo(summary.signals.emergingAt) : 'No scan yet'}</strong>
              </div>
              <div>
                <span>Whales</span>
                <strong>{summary.signals.whalesAt ? formatTimeAgo(summary.signals.whalesAt) : 'No scan yet'}</strong>
              </div>
            </div>
          </PanelShell>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.25fr_0.95fr]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatPanel icon={Bot} label="Connected bots" value={String(summary.totalBots)} detail={`${summary.enabledBots} enabled`} />
            <StatPanel icon={Activity} label="Live heartbeat" value={String(summary.liveBots)} detail={`${summary.staleBots} stale`} />
            <StatPanel icon={Wallet} label="Open positions" value={String(summary.openPositions)} detail="Across all linked strategies" />
            <StatPanel icon={Newspaper} label="Feed flow" value={String(summary.articleCount24h)} detail="Qualified stories in the last 24h" />
          </div>

          <PanelShell variant="secondary" className="hub-module-panel">
            <div className="hub-panel-header">
              <span className="hub-panel-label">Platform modules</span>
              <span className="hub-panel-meta">Shared surfaces</span>
            </div>
            <div className="grid gap-2">
              {MODULE_LINKS.map((item) => (
                <Link key={item.href} href={item.href} className="hub-module-link">
                  <div>
                    <p className="hub-module-title">{item.label}</p>
                    <p className="hub-module-note">{item.note}</p>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </PanelShell>
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.35fr_0.9fr]">
          <PanelShell variant="primary" className="hub-fleet-panel">
            <div className="hub-panel-header">
              <span className="hub-panel-label">Bot fleet</span>
              <span className="hub-panel-meta">Latest registry state</span>
            </div>

            {fleet.length === 0 ? (
              <div className="hub-empty-state">
                <Bot className="h-5 w-5" />
                <div>
                  <p>No bots registered yet.</p>
                  <span>Start pushing heartbeats to `/hub/heartbeat` from your external repos.</span>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                {fleet.map((bot) => (
                  <article key={bot.id} className="hub-bot-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="hub-bot-name">{bot.name}</h2>
                          <span className={cn('hub-pill', statusTone(bot.freshness))}>{bot.freshness}</span>
                          <span className={cn('hub-pill', statusTone(bot.status))}>{bot.status}</span>
                        </div>
                        <p className="hub-bot-meta">
                          {bot.slug}
                          {bot.strategyFamily ? ` • ${bot.strategyFamily}` : ''}
                          {bot.venue ? ` • ${bot.venue}` : ''}
                          {bot.category ? ` • ${bot.category}` : ''}
                        </p>
                      </div>
                      <p className="hub-bot-time">
                        {bot.lastHeartbeatAt ? `Heartbeat ${formatTimeAgo(bot.lastHeartbeatAt)}` : 'No heartbeat yet'}
                      </p>
                    </div>

                    <div className="hub-bot-stats">
                      <div>
                        <span>Equity</span>
                        <strong>{bot.latestMetric?.equityUsd != null ? formatCompactNumber(bot.latestMetric.equityUsd) : 'n/a'}</strong>
                      </div>
                      <div>
                        <span>Daily PnL</span>
                        <strong className={cn((bot.latestMetric?.dailyPnlUsd ?? 0) >= 0 ? 'text-bullish' : 'text-bearish')}>
                          {bot.latestMetric?.dailyPnlUsd != null ? formatSignedUsd(bot.latestMetric.dailyPnlUsd) : 'n/a'}
                        </strong>
                      </div>
                      <div>
                        <span>Drawdown</span>
                        <strong>{bot.latestMetric?.drawdownPct != null ? `${formatDecimal(bot.latestMetric.drawdownPct, 2)}%` : 'n/a'}</strong>
                      </div>
                      <div>
                        <span>Open positions</span>
                        <strong>{bot.latestMetric?.openPositions ?? bot.openPositions}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </PanelShell>

          <div className="grid gap-3">
            <PanelShell variant="secondary" className="hub-events-panel">
              <div className="hub-panel-header">
                <span className="hub-panel-label">Event stream</span>
                <span className="hub-panel-meta">Most recent bot activity</span>
              </div>
              {events.length === 0 ? (
                <div className="hub-empty-state">
                  <Radar className="h-5 w-5" />
                  <div>
                    <p>No bot events yet.</p>
                    <span>Push fills, alerts, and execution events to `/hub/events`.</span>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  {events.map((event) => (
                    <article key={event.id} className="hub-event-row">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('hub-pill', statusTone(event.severity))}>{event.severity}</span>
                        <span className="hub-event-time">{formatTimeAgo(event.eventAt)}</span>
                      </div>
                      <p className="hub-event-title">{event.title}</p>
                      <p className="hub-event-meta">
                        {event.botName} • {event.eventType}
                        {event.symbol ? ` • ${event.symbol}` : ''}
                      </p>
                      {event.body ? <p className="hub-event-body">{event.body}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </PanelShell>

            <PanelShell variant="secondary" className="hub-contract-panel">
              <div className="hub-panel-header">
                <span className="hub-panel-label">Integration contract</span>
                <span className="hub-panel-meta">For external bot repos</span>
              </div>
              <ul className="hub-contract-list">
                <li><ShieldAlert className="h-4 w-4" /> Register once at `/hub/bots/register`.</li>
                <li><Activity className="h-4 w-4" /> Send health updates to `/hub/heartbeat`.</li>
                <li><Wallet className="h-4 w-4" /> Publish equity and positions to `/hub/metrics` and `/hub/positions`.</li>
                <li><Radar className="h-4 w-4" /> Stream fills, errors, and notable actions to `/hub/events`.</li>
              </ul>
            </PanelShell>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatPanel({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <PanelShell variant="secondary" className="hub-stat-panel">
      <div className="hub-stat-icon">
        <Icon className="h-4 w-4" />
      </div>
      <p className="hub-stat-label">{label}</p>
      <p className="hub-stat-value">{value}</p>
      <p className="hub-stat-detail">{detail}</p>
    </PanelShell>
  );
}
