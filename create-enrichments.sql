-- Create enrichment records for all fetched articles that don't have one

INSERT INTO "Enrichment" (
    id,
    "articleId",
    "titleTh",
    "summaryTh",
    "takeawaysTh",
    tags,
    sentiment,
    "marketImpact",
    "hooksTh",
    "threadTh",
    "contentDraftTh",
    cautions,
    "mustQuote",
    "llmModel",
    "llmProvider",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    a.id,
    NULL,  -- titleTh (optional now)
    NULL,  -- summaryTh (optional now)
    '[]'::jsonb,  -- takeawaysTh
    CASE
        -- ETF/SEC → HIGH
        WHEN LOWER(a."titleOriginal") LIKE '%etf%' OR LOWER(a."titleOriginal") LIKE '%sec%'
            THEN '["ETF", "Regulation"]'::jsonb
        -- Institutional → HIGH
        WHEN LOWER(a."titleOriginal") LIKE '%institution%'
             OR LOWER(a."titleOriginal") LIKE '%blackrock%'
             OR LOWER(a."titleOriginal") LIKE '%wall street%'
            THEN '["Institutional", "Adoption"]'::jsonb
        -- Bitcoin
        WHEN LOWER(a."titleOriginal") LIKE '%bitcoin%' OR LOWER(a."titleOriginal") LIKE '%btc%'
            THEN '["BTC", "Bitcoin"]'::jsonb
        ELSE '[]'::jsonb
    END AS tags,
    CASE
        WHEN LOWER(a."titleOriginal") LIKE '%bull%'
             OR LOWER(a."titleOriginal") LIKE '%surge%'
             OR LOWER(a."titleOriginal") LIKE '%rally%'
             OR LOWER(a."titleOriginal") LIKE '%gain%'
            THEN 'BULLISH'::"Sentiment"
        WHEN LOWER(a."titleOriginal") LIKE '%bear%'
             OR LOWER(a."titleOriginal") LIKE '%crash%'
             OR LOWER(a."titleOriginal") LIKE '%dump%'
             OR LOWER(a."titleOriginal") LIKE '%fall%'
            THEN 'BEARISH'::"Sentiment"
        ELSE 'NEUTRAL'::"Sentiment"
    END AS sentiment,
    CASE
        -- ETF/SEC/Institutional → HIGH
        WHEN LOWER(a."titleOriginal") LIKE '%etf%'
             OR LOWER(a."titleOriginal") LIKE '%sec%'
             OR LOWER(a."titleOriginal") LIKE '%institution%'
             OR LOWER(a."titleOriginal") LIKE '%blackrock%'
            THEN 'HIGH'::"MarketImpact"
        -- Bitcoin + positive → HIGH
        WHEN (LOWER(a."titleOriginal") LIKE '%bitcoin%' OR LOWER(a."titleOriginal") LIKE '%btc%')
             AND (LOWER(a."titleOriginal") LIKE '%bull%'
                  OR LOWER(a."titleOriginal") LIKE '%surge%'
                  OR LOWER(a."titleOriginal") LIKE '%rally%')
            THEN 'HIGH'::"MarketImpact"
        -- Bitcoin neutral → MEDIUM
        WHEN LOWER(a."titleOriginal") LIKE '%bitcoin%' OR LOWER(a."titleOriginal") LIKE '%btc%'
            THEN 'MEDIUM'::"MarketImpact"
        -- Everything else → LOW
        ELSE 'LOW'::"MarketImpact"
    END AS "marketImpact",
    '[]'::jsonb,  -- hooksTh
    '[]'::jsonb,  -- threadTh
    NULL,  -- contentDraftTh
    NULL,  -- cautions
    NULL,  -- mustQuote
    'heuristic-v1',  -- llmModel
    'sql-mapping',   -- llmProvider
    NOW(),
    NOW()
FROM "Article" a
WHERE a.status = 'FETCHED'
  AND NOT EXISTS (
      SELECT 1 FROM "Enrichment" e WHERE e."articleId" = a.id
  )
LIMIT 100;

-- Update article status to ENRICHED
UPDATE "Article" a
SET status = 'ENRICHED'
WHERE a.status = 'FETCHED'
  AND EXISTS (
      SELECT 1 FROM "Enrichment" e WHERE e."articleId" = a.id
  );

-- Show results
SELECT
    e."marketImpact",
    COUNT(*) as count
FROM "Enrichment" e
JOIN "Article" a ON a.id = e."articleId"
WHERE a.status = 'ENRICHED'
GROUP BY e."marketImpact"
ORDER BY e."marketImpact";
