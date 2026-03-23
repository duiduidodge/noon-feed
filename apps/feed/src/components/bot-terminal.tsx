import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Bot,
  ChevronRight,
  Cpu,
  ExternalLink,
  Radar,
  Wallet,
} from 'lucide-react';
import { PanelShell } from '@/components/panel-shell';
import {
  cn,
  formatCompactNumber,
  formatDecimal,
  formatSignedUsd,
  formatTimeAgo,
} from '@/lib/utils';
import type { BotDescription } from '@/lib/bot-descriptions';

interface BotMetric {
  equityUsd: number | null;
  cashUsd: number | null;
  realizedPnlUsd: number | null;
  unrealizedPnlUsd: number | null;
  dailyPnlUsd: number | null;
  drawdownPct: number | null;
  winRatePct: number | null;
  openPositions: number | null;
  observedAt: Date;
}

interface BotPosition {
  id: string;
  symbol: string;
  side: string;
  quantity: number | null;
  entryPrice: number | null;
  markPrice: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  openedAt: Date | null;
}

interface BotEvent {
  id: string;
  eventType: string;
  severity: string;
  title: string;
  body: string | null;
  symbol: string | null;
  eventAt: Date;
}

interface BotData {
  id: string;
  slug: string;
  name: string;
  environment: string;
  category: string | null;
  strategyFamily: string | null;
  venue: string | null;
  repoUrl: string | null;
  dashboardUrl: string | null;
  status: string;
  isEnabled: boolean;
  lastHeartbeatAt: Date | null;
  freshness: 'LIVE' | 'STALE';
  latestMetric: BotMetric | null;
  positions: BotPosition[];
  events: BotEvent[];
}

interface BotTerminalProps {
  bot: BotData;
  description: BotDescription | null;
}

function statusTone(status: string) {
  const normalized = status.toUpperCase();
  if (['LIVE', 'HEALTHY', 'RUNNING'].includes(normalized))
    return 'text-bullish border-bullish/35 bg-bullish/10';
  if (['DEGRADED', 'STALE'].includes(normalized))
    return 'text-amber-500 border-amber-400/35 bg-amber-400/10';
  if (['ERROR', 'HALTED'].includes(normalized))
    return 'text-bearish border-bearish/35 bg-bearish/10';
  return 'text-muted-foreground border-border/40 bg-surface/50';
}

function MetricCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="terminal-metric-cell">
      <span className="terminal-metric-label">{label}</span>
      <strong className={cn('terminal-metric-value', tone)}>{value}</strong>
    </div>
  );
}

export function BotTerminal({ bot, description }: BotTerminalProps) {
  const m = bot.latestMetric;

  return (
    <div className="relative min-h-[100dvh] bg-transparent">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--border) / 0.34) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.34) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          backgroundPosition: '0 0, 0 0',
          opacity: 0.9,
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.96), rgba(0,0,0,0.84))',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.96), rgba(0,0,0,0.84))',
        }}
      />
      <main
        id="hub-main"
        className="relative mx-auto flex w-full max-w-[1640px] flex-col gap-4 px-3 pb-8 pt-4 md:px-5 lg:px-6"
      >
        {/* Back navigation */}
        <div className="flex items-center gap-3">
          <Link href="/" className="terminal-back-link">
            <ArrowLeft className="h-3.5 w-3.5" />
            Hub
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
          <span className="font-mono-data text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {bot.name}
          </span>
        </div>

        {/* Header */}
        <section className="terminal-header-grid">
          <PanelShell variant="primary" className="terminal-header-panel">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="terminal-bot-name">{bot.name}</h1>
                  <span className={cn('hub-pill', statusTone(bot.freshness))}>
                    {bot.freshness}
                  </span>
                  <span className={cn('hub-pill', statusTone(bot.status))}>
                    {bot.status}
                  </span>
                  {!bot.isEnabled && (
                    <span className="hub-pill text-muted-foreground border-border/40 bg-surface/50">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="terminal-bot-meta">
                  <span>{bot.slug}</span>
                  {bot.strategyFamily && <span> · {bot.strategyFamily}</span>}
                  {bot.venue && <span> · {bot.venue}</span>}
                  {bot.category && <span> · {bot.category}</span>}
                  <span className="ml-1 capitalize"> · {bot.environment}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {bot.dashboardUrl && (
                  <a
                    href={bot.dashboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="terminal-ext-link"
                  >
                    Open dashboard
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {bot.repoUrl && (
                  <a
                    href={bot.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="terminal-ext-link"
                  >
                    Repo
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
            <p className="terminal-heartbeat">
              {bot.lastHeartbeatAt
                ? `Last heartbeat ${formatTimeAgo(bot.lastHeartbeatAt)}`
                : 'No heartbeat recorded yet'}
            </p>
          </PanelShell>

          {/* Strategy description */}
          {description && (
            <PanelShell variant="secondary" className="terminal-strategy-panel">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="h-4 w-4 text-primary" />
                <span className="hub-panel-label">Strategy</span>
              </div>
              <p className="terminal-strategy-tagline">{description.tagline}</p>
              <p className="terminal-strategy-body">{description.strategy}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {description.tags.map((tag) => (
                  <span key={tag} className="terminal-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </PanelShell>
          )}
        </section>

        {/* Metrics */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCell
            label="Equity"
            value={m?.equityUsd != null ? formatCompactNumber(m.equityUsd) : 'n/a'}
          />
          <MetricCell
            label="Daily PnL"
            value={m?.dailyPnlUsd != null ? formatSignedUsd(m.dailyPnlUsd) : 'n/a'}
            tone={
              m?.dailyPnlUsd != null
                ? m.dailyPnlUsd >= 0
                  ? 'text-bullish'
                  : 'text-bearish'
                : undefined
            }
          />
          <MetricCell
            label="Drawdown"
            value={m?.drawdownPct != null ? `${formatDecimal(m.drawdownPct, 2)}%` : 'n/a'}
            tone={m?.drawdownPct != null && m.drawdownPct > 0 ? 'text-bearish' : undefined}
          />
          <MetricCell
            label="Win Rate"
            value={m?.winRatePct != null ? `${formatDecimal(m.winRatePct, 1)}%` : 'n/a'}
          />
          <MetricCell
            label="Unrealized PnL"
            value={
              m?.unrealizedPnlUsd != null ? formatSignedUsd(m.unrealizedPnlUsd) : 'n/a'
            }
            tone={
              m?.unrealizedPnlUsd != null
                ? m.unrealizedPnlUsd >= 0
                  ? 'text-bullish'
                  : 'text-bearish'
                : undefined
            }
          />
          <MetricCell
            label="Realized PnL"
            value={
              m?.realizedPnlUsd != null ? formatSignedUsd(m.realizedPnlUsd) : 'n/a'
            }
            tone={
              m?.realizedPnlUsd != null
                ? m.realizedPnlUsd >= 0
                  ? 'text-bullish'
                  : 'text-bearish'
                : undefined
            }
          />
          <MetricCell
            label="Cash"
            value={m?.cashUsd != null ? formatCompactNumber(m.cashUsd) : 'n/a'}
          />
          <MetricCell
            label="Open Positions"
            value={String(m?.openPositions ?? bot.positions.length)}
          />
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
          {/* Open Positions */}
          <PanelShell variant="primary" className="terminal-positions-panel">
            <div className="hub-panel-header">
              <span className="hub-panel-label">Open positions</span>
              <span className="hub-panel-meta">{bot.positions.length} active</span>
            </div>
            {bot.positions.length === 0 ? (
              <div className="hub-empty-state">
                <Wallet className="h-5 w-5" />
                <div>
                  <p>No open positions.</p>
                  <span>Positions will appear here when the bot enters a trade.</span>
                </div>
              </div>
            ) : (
              <div className="terminal-positions-table">
                <div className="terminal-table-header">
                  <span>Symbol</span>
                  <span>Side</span>
                  <span>Qty</span>
                  <span>Entry</span>
                  <span>Mark</span>
                  <span>PnL</span>
                  <span>Opened</span>
                </div>
                {bot.positions.map((p) => (
                  <div key={p.id} className="terminal-table-row">
                    <span className="terminal-symbol">{p.symbol}</span>
                    <span
                      className={cn(
                        'hub-pill text-[0.65rem]',
                        p.side.toUpperCase() === 'LONG'
                          ? 'text-bullish border-bullish/35 bg-bullish/10'
                          : 'text-bearish border-bearish/35 bg-bearish/10'
                      )}
                    >
                      {p.side}
                    </span>
                    <span>{p.quantity != null ? formatDecimal(p.quantity, 4) : '—'}</span>
                    <span>{p.entryPrice != null ? formatCompactNumber(p.entryPrice) : '—'}</span>
                    <span>{p.markPrice != null ? formatCompactNumber(p.markPrice) : '—'}</span>
                    <span
                      className={cn(
                        p.pnlUsd != null
                          ? p.pnlUsd >= 0
                            ? 'text-bullish'
                            : 'text-bearish'
                          : ''
                      )}
                    >
                      {p.pnlUsd != null ? formatSignedUsd(p.pnlUsd) : '—'}
                      {p.pnlPct != null && (
                        <span className="ml-1 opacity-60">
                          ({p.pnlPct >= 0 ? '+' : ''}
                          {formatDecimal(p.pnlPct, 2)}%)
                        </span>
                      )}
                    </span>
                    <span className="hub-bot-time">
                      {p.openedAt ? formatTimeAgo(p.openedAt) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </PanelShell>

          {/* Event Stream */}
          <PanelShell variant="secondary" className="hub-events-panel">
            <div className="hub-panel-header">
              <span className="hub-panel-label">Event stream</span>
              <span className="hub-panel-meta">Last {bot.events.length} events</span>
            </div>
            {bot.events.length === 0 ? (
              <div className="hub-empty-state">
                <Radar className="h-5 w-5" />
                <div>
                  <p>No events yet.</p>
                  <span>Fills, alerts, and execution events will appear here.</span>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                {bot.events.map((event) => (
                  <article key={event.id} className="hub-event-row">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('hub-pill', statusTone(event.severity))}>
                        {event.severity}
                      </span>
                      <span className="hub-event-time">{formatTimeAgo(event.eventAt)}</span>
                    </div>
                    <p className="hub-event-title">{event.title}</p>
                    <p className="hub-event-meta">
                      {event.eventType}
                      {event.symbol ? ` · ${event.symbol}` : ''}
                    </p>
                    {event.body && <p className="hub-event-body">{event.body}</p>}
                  </article>
                ))}
              </div>
            )}
          </PanelShell>
        </section>

        {/* No live data notice */}
        {!bot.latestMetric && (
          <div className="hub-empty-state">
            <Activity className="h-5 w-5" />
            <div>
              <p>No metrics received yet.</p>
              <span>
                Push equity and position data to <code>/hub/metrics</code> from your bot
                to see live numbers.
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
