-- Whale index snapshots + trader signals

CREATE TABLE IF NOT EXISTS "WhaleSnapshot" (
  "id" TEXT NOT NULL,
  "scan_time" TIMESTAMP(3) NOT NULL,
  "timeframe" TEXT NOT NULL DEFAULT '30d',
  "candidates" INTEGER DEFAULT 0,
  "selected_count" INTEGER DEFAULT 0,
  "raw_payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhaleSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WhaleTrader" (
  "id" TEXT NOT NULL,
  "snapshot_id" TEXT NOT NULL,
  "wallet_address" TEXT NOT NULL,
  "score" DECIMAL(6,2),
  "rank" INTEGER,
  "consistency" TEXT,
  "risk_label" TEXT,
  "pnl_rank" INTEGER,
  "win_rate" DECIMAL(6,2),
  "hold_time_hours" DECIMAL(10,2),
  "max_drawdown_pct" DECIMAL(6,2),
  "allocation_pct" DECIMAL(6,2),
  "overlap_risk_pct" DECIMAL(6,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhaleTrader_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WhaleSnapshot_scan_time_idx" ON "WhaleSnapshot"("scan_time");
CREATE INDEX IF NOT EXISTS "WhaleSnapshot_created_at_idx" ON "WhaleSnapshot"("created_at");
CREATE INDEX IF NOT EXISTS "WhaleTrader_snapshot_id_idx" ON "WhaleTrader"("snapshot_id");
CREATE INDEX IF NOT EXISTS "WhaleTrader_wallet_address_idx" ON "WhaleTrader"("wallet_address");
CREATE INDEX IF NOT EXISTS "WhaleTrader_score_idx" ON "WhaleTrader"("score");
CREATE INDEX IF NOT EXISTS "WhaleTrader_rank_idx" ON "WhaleTrader"("rank");
CREATE INDEX IF NOT EXISTS "WhaleTrader_created_at_idx" ON "WhaleTrader"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WhaleTrader_snapshot_id_fkey'
  ) THEN
    ALTER TABLE "WhaleTrader"
      ADD CONSTRAINT "WhaleTrader_snapshot_id_fkey"
      FOREIGN KEY ("snapshot_id") REFERENCES "WhaleSnapshot"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
