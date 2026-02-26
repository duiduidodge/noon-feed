-- Emerging Movers signal snapshots + alerts

CREATE TABLE IF NOT EXISTS "EmergingMoverSnapshot" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ok',
  "signal_time" TIMESTAMP(3) NOT NULL,
  "totalMarkets" INTEGER,
  "scansInHistory" INTEGER,
  "has_immediate" BOOLEAN NOT NULL DEFAULT false,
  "has_emerging_mover" BOOLEAN NOT NULL DEFAULT false,
  "has_deep_climber" BOOLEAN NOT NULL DEFAULT false,
  "top5" JSONB,
  "raw_payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmergingMoverSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmergingMoverAlert" (
  "id" TEXT NOT NULL,
  "snapshot_id" TEXT NOT NULL,
  "signal" TEXT NOT NULL,
  "direction" TEXT,
  "current_rank" INTEGER,
  "contribution" DECIMAL(6,2),
  "contrib_velocity" DECIMAL(8,4),
  "price_chg_4h" DECIMAL(8,2),
  "traders" INTEGER,
  "reason_count" INTEGER NOT NULL DEFAULT 0,
  "reasons" JSONB NOT NULL,
  "rank_history" JSONB,
  "contrib_history" JSONB,
  "is_immediate" BOOLEAN NOT NULL DEFAULT false,
  "is_deep_climber" BOOLEAN NOT NULL DEFAULT false,
  "erratic" BOOLEAN NOT NULL DEFAULT false,
  "low_velocity" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmergingMoverAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmergingMoverSnapshot_signal_time_idx" ON "EmergingMoverSnapshot"("signal_time");
CREATE INDEX IF NOT EXISTS "EmergingMoverSnapshot_created_at_idx" ON "EmergingMoverSnapshot"("created_at");
CREATE INDEX IF NOT EXISTS "EmergingMoverAlert_snapshot_id_idx" ON "EmergingMoverAlert"("snapshot_id");
CREATE INDEX IF NOT EXISTS "EmergingMoverAlert_is_immediate_idx" ON "EmergingMoverAlert"("is_immediate");
CREATE INDEX IF NOT EXISTS "EmergingMoverAlert_current_rank_idx" ON "EmergingMoverAlert"("current_rank");
CREATE INDEX IF NOT EXISTS "EmergingMoverAlert_created_at_idx" ON "EmergingMoverAlert"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EmergingMoverAlert_snapshot_id_fkey'
  ) THEN
    ALTER TABLE "EmergingMoverAlert"
      ADD CONSTRAINT "EmergingMoverAlert_snapshot_id_fkey"
      FOREIGN KEY ("snapshot_id") REFERENCES "EmergingMoverSnapshot"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
