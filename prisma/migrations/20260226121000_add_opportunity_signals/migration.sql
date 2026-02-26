-- Opportunity scanner snapshots + opportunities

CREATE TABLE IF NOT EXISTS "OpportunitySnapshot" (
  "id" TEXT NOT NULL,
  "scan_time" TIMESTAMP(3) NOT NULL,
  "assets_scanned" INTEGER,
  "passed_stage1" INTEGER,
  "passed_stage2" INTEGER,
  "deep_dived" INTEGER,
  "disqualified" INTEGER NOT NULL DEFAULT 0,
  "btc_context" JSONB,
  "raw_payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunitySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OpportunitySignal" (
  "id" TEXT NOT NULL,
  "snapshot_id" TEXT NOT NULL,
  "asset" TEXT NOT NULL,
  "direction" TEXT,
  "leverage" INTEGER,
  "final_score" INTEGER,
  "score_delta" INTEGER,
  "scan_streak" INTEGER,
  "hourly_trend" TEXT,
  "trend_aligned" BOOLEAN NOT NULL DEFAULT false,
  "pillar_scores" JSONB,
  "smart_money" JSONB,
  "technicals" JSONB,
  "funding" JSONB,
  "risks" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunitySignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OpportunitySnapshot_scan_time_idx" ON "OpportunitySnapshot"("scan_time");
CREATE INDEX IF NOT EXISTS "OpportunitySnapshot_created_at_idx" ON "OpportunitySnapshot"("created_at");
CREATE INDEX IF NOT EXISTS "OpportunitySignal_snapshot_id_idx" ON "OpportunitySignal"("snapshot_id");
CREATE INDEX IF NOT EXISTS "OpportunitySignal_asset_idx" ON "OpportunitySignal"("asset");
CREATE INDEX IF NOT EXISTS "OpportunitySignal_final_score_idx" ON "OpportunitySignal"("final_score");
CREATE INDEX IF NOT EXISTS "OpportunitySignal_created_at_idx" ON "OpportunitySignal"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OpportunitySignal_snapshot_id_fkey'
  ) THEN
    ALTER TABLE "OpportunitySignal"
      ADD CONSTRAINT "OpportunitySignal_snapshot_id_fkey"
      FOREIGN KEY ("snapshot_id") REFERENCES "OpportunitySnapshot"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
