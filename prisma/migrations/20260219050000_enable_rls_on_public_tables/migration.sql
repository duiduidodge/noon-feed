-- Enable RLS on public tables exposed to PostgREST/Supabase.
-- Service-role/server connections keep working; anon/auth access is policy-controlled.

ALTER TABLE IF EXISTS "Source" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "JobAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "UserPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "MarketSummary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Posting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Enrichment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Article" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "HighImpactQuota" ENABLE ROW LEVEL SECURITY;

-- Public read policies for feed-facing tables.
DROP POLICY IF EXISTS source_public_read ON "Source";
CREATE POLICY source_public_read
  ON "Source"
  FOR SELECT
  TO anon, authenticated
  USING (enabled = true);

DROP POLICY IF EXISTS article_public_read ON "Article";
CREATE POLICY article_public_read
  ON "Article"
  FOR SELECT
  TO anon, authenticated
  USING (status IN ('FETCHED', 'ENRICHED'));

DROP POLICY IF EXISTS enrichment_public_read ON "Enrichment";
CREATE POLICY enrichment_public_read
  ON "Enrichment"
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS user_post_public_read ON "UserPost";
CREATE POLICY user_post_public_read
  ON "UserPost"
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS market_summary_public_read ON "MarketSummary";
CREATE POLICY market_summary_public_read
  ON "MarketSummary"
  FOR SELECT
  TO anon, authenticated
  USING (true);
