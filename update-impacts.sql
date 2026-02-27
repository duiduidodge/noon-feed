-- Update enrichments to better impact scores based on article titles

-- ETF articles → HIGH
UPDATE "Enrichment" e
SET "marketImpact" = 'HIGH',
    tags = '["ETF", "Regulation"]'::jsonb
FROM "Article" a
WHERE e."articleId" = a.id
  AND e."marketImpact" = 'LOW'
  AND (LOWER(a."titleOriginal") LIKE '%etf%' OR LOWER(a."titleOriginal") LIKE '%sec%');

-- Institutional articles → HIGH
UPDATE "Enrichment" e
SET "marketImpact" = 'HIGH',
    tags = '["Institutional", "Adoption"]'::jsonb
FROM "Article" a
WHERE e."articleId" = a.id
  AND e."marketImpact" = 'LOW'
  AND (LOWER(a."titleOriginal") LIKE '%institution%'
       OR LOWER(a."titleOriginal") LIKE '%bank%'
       OR LOWER(a."titleOriginal") LIKE '%wall street%'
       OR LOWER(a."titleOriginal") LIKE '%blackrock%');

-- Bitcoin positive news → HIGH
UPDATE "Enrichment" e
SET "marketImpact" = 'HIGH',
    sentiment = 'BULLISH',
    tags = '["BTC", "Bitcoin"]'::jsonb
FROM "Article" a
WHERE e."articleId" = a.id
  AND e."marketImpact" = 'LOW'
  AND (LOWER(a."titleOriginal") LIKE '%bitcoin%' OR LOWER(a."titleOriginal") LIKE '%btc%')
  AND (LOWER(a."titleOriginal") LIKE '%surge%'
       OR LOWER(a."titleOriginal") LIKE '%rally%'
       OR LOWER(a."titleOriginal") LIKE '%bull%'
       OR LOWER(a."titleOriginal") LIKE '%gain%');

-- Bitcoin neutral news → MEDIUM
UPDATE "Enrichment" e
SET "marketImpact" = 'MEDIUM',
    tags = '["BTC", "Bitcoin"]'::jsonb
FROM "Article" a
WHERE e."articleId" = a.id
  AND e."marketImpact" = 'LOW'
  AND (LOWER(a."titleOriginal") LIKE '%bitcoin%' OR LOWER(a."titleOriginal") LIKE '%btc%');

-- Show results
SELECT
    e."marketImpact",
    COUNT(*) as count
FROM "Enrichment" e
GROUP BY e."marketImpact"
ORDER BY e."marketImpact";
