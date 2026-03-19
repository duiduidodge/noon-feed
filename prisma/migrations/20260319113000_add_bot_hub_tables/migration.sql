CREATE TABLE "BotAgent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "category" TEXT,
    "strategy_family" TEXT,
    "venue" TEXT,
    "repo_url" TEXT,
    "dashboard_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_heartbeat_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BotHeartbeat" (
    "id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "version" TEXT,
    "latency_ms" INTEGER,
    "uptime_sec" INTEGER,
    "metadata" JSONB,
    "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotHeartbeat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BotMetricSnapshot" (
    "id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "equity_usd" DECIMAL(20,4),
    "cash_usd" DECIMAL(20,4),
    "realized_pnl_usd" DECIMAL(20,4),
    "unrealized_pnl_usd" DECIMAL(20,4),
    "daily_pnl_usd" DECIMAL(20,4),
    "drawdown_pct" DECIMAL(8,4),
    "win_rate_pct" DECIMAL(8,4),
    "open_positions" INTEGER,
    "metadata" JSONB,
    "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotMetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BotPositionSnapshot" (
    "id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "quantity" DECIMAL(20,8),
    "entry_price" DECIMAL(20,8),
    "mark_price" DECIMAL(20,8),
    "pnl_usd" DECIMAL(20,4),
    "pnl_pct" DECIMAL(8,4),
    "opened_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "snapshot_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotPositionSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BotEvent" (
    "id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "symbol" TEXT,
    "payload" JSONB,
    "event_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BotAgent_slug_key" ON "BotAgent"("slug");
CREATE INDEX "BotAgent_status_idx" ON "BotAgent"("status");
CREATE INDEX "BotAgent_environment_idx" ON "BotAgent"("environment");
CREATE INDEX "BotAgent_category_idx" ON "BotAgent"("category");
CREATE INDEX "BotAgent_last_heartbeat_at_idx" ON "BotAgent"("last_heartbeat_at");

CREATE INDEX "BotHeartbeat_bot_id_observed_at_idx" ON "BotHeartbeat"("bot_id", "observed_at");
CREATE INDEX "BotHeartbeat_status_idx" ON "BotHeartbeat"("status");

CREATE INDEX "BotMetricSnapshot_bot_id_observed_at_idx" ON "BotMetricSnapshot"("bot_id", "observed_at");

CREATE INDEX "BotPositionSnapshot_bot_id_snapshot_time_idx" ON "BotPositionSnapshot"("bot_id", "snapshot_time");
CREATE INDEX "BotPositionSnapshot_symbol_idx" ON "BotPositionSnapshot"("symbol");
CREATE INDEX "BotPositionSnapshot_status_idx" ON "BotPositionSnapshot"("status");

CREATE INDEX "BotEvent_bot_id_event_at_idx" ON "BotEvent"("bot_id", "event_at");
CREATE INDEX "BotEvent_severity_idx" ON "BotEvent"("severity");
CREATE INDEX "BotEvent_event_type_idx" ON "BotEvent"("event_type");

ALTER TABLE "BotHeartbeat" ADD CONSTRAINT "BotHeartbeat_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "BotAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotMetricSnapshot" ADD CONSTRAINT "BotMetricSnapshot_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "BotAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotPositionSnapshot" ADD CONSTRAINT "BotPositionSnapshot_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "BotAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotEvent" ADD CONSTRAINT "BotEvent_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "BotAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
