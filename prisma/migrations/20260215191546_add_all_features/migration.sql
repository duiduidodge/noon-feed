-- ============================================================
-- Migration: Add all 4 features (Full-Text Search, Enhanced Sentiment, On-Chain Metrics, High-Impact Posting)
-- ============================================================

-- Feature 1: Full-Text Search
-- Add tsvector columns for English and Thai full-text search
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "search_vector_en" tsvector;
ALTER TABLE "Enrichment" ADD COLUMN IF NOT EXISTS "search_vector_th" tsvector;

-- Create GIN indexes for fast full-text search
CREATE INDEX IF NOT EXISTS "Article_search_vector_en_idx" ON "Article" USING GIN("search_vector_en");
CREATE INDEX IF NOT EXISTS "Enrichment_search_vector_th_idx" ON "Enrichment" USING GIN("search_vector_th");

-- Create trigger function to auto-update Article search vector
CREATE OR REPLACE FUNCTION article_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector_en :=
    setweight(to_tsvector('english', COALESCE(NEW."titleOriginal", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."extractedText", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update on INSERT/UPDATE
DROP TRIGGER IF EXISTS article_search_vector_trigger ON "Article";
CREATE TRIGGER article_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "Article"
  FOR EACH ROW EXECUTE FUNCTION article_search_vector_update();

-- Create trigger function to auto-update Enrichment search vector
CREATE OR REPLACE FUNCTION enrichment_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector_th :=
    setweight(to_tsvector('simple', COALESCE(NEW."titleTh", '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW."summaryTh", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update on INSERT/UPDATE
DROP TRIGGER IF EXISTS enrichment_search_vector_trigger ON "Enrichment";
CREATE TRIGGER enrichment_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "Enrichment"
  FOR EACH ROW EXECUTE FUNCTION enrichment_search_vector_update();

-- Backfill existing Article data
UPDATE "Article" SET search_vector_en =
  setweight(to_tsvector('english', COALESCE("titleOriginal", '')), 'A') ||
  setweight(to_tsvector('english', COALESCE("extractedText", '')), 'B')
WHERE search_vector_en IS NULL;

-- Backfill existing Enrichment data
UPDATE "Enrichment" SET search_vector_th =
  setweight(to_tsvector('simple', COALESCE("titleTh", '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE("summaryTh", '')), 'B')
WHERE search_vector_th IS NULL;

-- Feature 2: Enhanced Sentiment Analysis
-- Add external sentiment data columns to Enrichment
ALTER TABLE "Enrichment" ADD COLUMN IF NOT EXISTS "finnhub_sentiment" JSONB;
ALTER TABLE "Enrichment" ADD COLUMN IF NOT EXISTS "fmp_sentiment" JSONB;
ALTER TABLE "Enrichment" ADD COLUMN IF NOT EXISTS "sentiment_confidence" DECIMAL(3,2);

CREATE INDEX IF NOT EXISTS "Enrichment_sentiment_confidence_idx" ON "Enrichment"("sentiment_confidence");

-- Feature 3: On-Chain Metrics
-- Add Santiment metrics columns to Enrichment
ALTER TABLE "Enrichment" ADD COLUMN IF NOT EXISTS "santiment_metrics" JSONB;
ALTER TABLE "Enrichment" ADD COLUMN IF NOT EXISTS "metrics_fetched_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Enrichment_metrics_fetched_at_idx" ON "Enrichment"("metrics_fetched_at");

-- Feature 4: High-Impact Article Posting
-- Add impact filter columns to Article
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "impact_score" DECIMAL(3,2);
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "pre_filter_passed" BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "Article_impact_score_idx" ON "Article"("impact_score");
CREATE INDEX IF NOT EXISTS "Article_pre_filter_passed_idx" ON "Article"("pre_filter_passed");

-- Add posting type to Posting
ALTER TABLE "Posting" ADD COLUMN IF NOT EXISTS "posting_type" TEXT DEFAULT 'SUMMARY';

CREATE INDEX IF NOT EXISTS "Posting_posting_type_idx" ON "Posting"("posting_type");

-- Create HighImpactQuota table for daily posting limits
CREATE TABLE IF NOT EXISTS "HighImpactQuota" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" DATE NOT NULL UNIQUE,
  "posted_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "HighImpactQuota_date_idx" ON "HighImpactQuota"("date");

-- Add comments for documentation
COMMENT ON COLUMN "Article"."search_vector_en" IS 'Full-text search vector for English content (title + text)';
COMMENT ON COLUMN "Article"."impact_score" IS 'Pre-filter impact score 0.00-1.00 from LLM evaluation';
COMMENT ON COLUMN "Article"."pre_filter_passed" IS 'Whether article passed impact threshold for enrichment';

COMMENT ON COLUMN "Enrichment"."search_vector_th" IS 'Full-text search vector for Thai content (title + summary)';
COMMENT ON COLUMN "Enrichment"."finnhub_sentiment" IS 'Sentiment data from Finnhub API (JSON)';
COMMENT ON COLUMN "Enrichment"."fmp_sentiment" IS 'Sentiment data from Financial Modeling Prep API (JSON)';
COMMENT ON COLUMN "Enrichment"."sentiment_confidence" IS 'Aggregated confidence score 0.00-1.00 based on LLM + API agreement';
COMMENT ON COLUMN "Enrichment"."santiment_metrics" IS 'On-chain metrics from Santiment API (JSON)';
COMMENT ON COLUMN "Enrichment"."metrics_fetched_at" IS 'Timestamp when on-chain metrics were last fetched';

COMMENT ON COLUMN "Posting"."posting_type" IS 'Type of posting: SUMMARY (bi-daily) or HIGH_IMPACT (urgent news)';

COMMENT ON TABLE "HighImpactQuota" IS 'Tracks daily posting quota for high-impact articles to prevent spam';
COMMENT ON COLUMN "HighImpactQuota"."posted_count" IS 'Number of high-impact articles posted today';
