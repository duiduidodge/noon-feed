import pino from 'pino';

// Logger setup
export function createLogger(name: string, level?: string) {
  return pino({
    name,
    level: level || process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  });
}

// URL normalization for deduplication
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove common tracking parameters
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'source',
      'fbclid',
      'gclid',
      'mc_cid',
      'mc_eid',
    ];

    trackingParams.forEach((param) => {
      parsed.searchParams.delete(param);
    });

    // Normalize host (remove www prefix)
    let host = parsed.host.replace(/^www\./, '');

    // Remove trailing slashes from pathname
    let pathname = parsed.pathname.replace(/\/+$/, '') || '/';

    // Sort remaining query params for consistency
    const sortedParams = new URLSearchParams(
      [...parsed.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    );

    // Rebuild URL
    let normalized = `${parsed.protocol}//${host}${pathname}`;
    const queryString = sortedParams.toString();
    if (queryString) {
      normalized += `?${queryString}`;
    }

    return normalized.toLowerCase();
  } catch (e) {
    // If URL parsing fails, return original lowercased
    return url.toLowerCase();
  }
}

// Create hash for article deduplication
export function createArticleHash(title: string, url: string, publishedAt?: Date): string {
  const normalizedUrl = normalizeUrl(url);
  const normalizedTitle = title.toLowerCase().trim();
  const timestamp = publishedAt?.toISOString().split('T')[0] || '';

  const combined = `${normalizedTitle}|${normalizedUrl}|${timestamp}`;

  // Simple hash function (not cryptographic, just for dedup)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
}

// Title similarity check using Levenshtein distance
export function calculateTitleSimilarity(title1: string, title2: string): number {
  const s1 = title1.toLowerCase().trim();
  const s2 = title2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

// Check if two articles are likely duplicates
export function isDuplicateArticle(
  existing: { titleOriginal: string; urlNormalized: string },
  incoming: { title: string; url: string }
): boolean {
  // Check URL match first
  const normalizedIncoming = normalizeUrl(incoming.url);
  if (existing.urlNormalized === normalizedIncoming) {
    return true;
  }

  // Check title similarity (threshold: 0.85 = 85% similar)
  const titleSimilarity = calculateTitleSimilarity(existing.titleOriginal, incoming.title);
  return titleSimilarity >= 0.85;
}

// Retry with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: Error) => boolean;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000, shouldRetry, onRetry } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      // If shouldRetry is provided, check if this error is retryable
      if (shouldRetry && !shouldRetry(lastError)) {
        throw lastError;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      onRetry?.(lastError, attempt + 1);
      await sleep(delay);
    }
  }

  throw lastError;
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Rate limiter
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRatePerSecond: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRatePerSecond;
    this.lastRefill = Date.now();
  }

  async acquire(tokens: number = 1): Promise<void> {
    this.refill();

    while (this.tokens < tokens) {
      const tokensNeeded = tokens - this.tokens;
      const waitTime = (tokensNeeded / this.refillRate) * 1000;
      await sleep(Math.min(waitTime, 1000));
      this.refill();
    }

    this.tokens -= tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }
}

// Format date for display
export function formatDate(date: Date | string | null): string {
  if (!date) return 'Unknown';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

// Format date for Thai display
export function formatDateThai(date: Date | string | null): string {
  if (!date) return 'ไม่ทราบ';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

// Truncate text with ellipsis
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Clean HTML to plain text
export function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Chunk array into smaller arrays
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Deep merge objects
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        (target[key] || {}) as Record<string, unknown>,
        source[key] as Record<string, unknown>
      ) as T[typeof key];
    } else if (source[key] !== undefined) {
      result[key] = source[key] as T[typeof key];
    }
  }

  return result;
}

// Safe JSON parse
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// Escape markdown for Discord
export function escapeMarkdown(text: string): string {
  return text.replace(/([*_`~|\\])/g, '\\$1');
}

// Format tags for display
export function formatTags(tags: string[]): string {
  return tags.map((tag) => `#${tag}`).join(' ');
}

// ── Article noise filter ──────────────────────────────────────────
// Patterns that indicate low-value content not worth enriching.
// Matched case-insensitively against the article title.

const NOISE_TITLE_PATTERNS: RegExp[] = [
  // Sponsored / promotional
  /\bsponsored\b/i,
  /\bpress release\b/i,
  /\bpartner content\b/i,
  /\badvertorial\b/i,
  /\bpaid post\b/i,

  // Price prediction clickbait
  /\bprice prediction\b/i,
  /\bprice forecast\b/i,
  /\bprice target\b/i,
  /\bwill reach \$[\d,]+/i,
  /\bcould hit \$[\d,]+/i,
  /\bcould reach \$[\d,]+/i,
  /\bto the moon\b/i,
  /\brealistic price\b/i,

  // Listicles / "top X" filler
  /\btop \d+ (best |)?(crypto|coin|altcoin|token)/i,
  /\b\d+ best (crypto|coin|altcoin|token)/i,
  /\b\d+ (crypto|coin|altcoin|token)s? to (buy|watch|invest)/i,

  // Technical analysis filler (daily TA posts are rarely newsworthy)
  /^(ta|technical analysis):/i,
  /\btechnical analysis\b.*\b(daily|weekly|hourly)\b/i,
  /\bchart (pattern|analysis)\b.*\b(shows|suggests|indicates)\b/i,

  // Giveaway / airdrop spam
  /\bgiveaway\b/i,
  /\bfree (token|coin|crypto|nft)s?\b/i,
  /\bclaim (your |)(free |)(token|coin|airdrop)/i,

  // Thin price movement rehash (e.g. "Bitcoin Price Dips 1.2% Today")
  /\bprice (dips|drops|falls|rises|surges|jumps|pumps|dumps|slips|gains) [\d.]+%/i,

  // Generic index/listing pages that repeatedly appear in some feeds
  /\bcrypto news\s*&\s*price indexes\b/i,
];

/**
 * Check if an article title indicates noise / low-value content.
 * Returns a reason string if noisy, or null if the article looks fine.
 */
export function isNoiseTitle(title: string): string | null {
  if (!title || title.trim().length < 15) {
    return 'title too short';
  }

  for (const pattern of NOISE_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      return `matched noise pattern: ${pattern.source}`;
    }
  }

  return null;
}

// ── Allowed API sources ───────────────────────────────────────────
// Only articles from these outlets (matched case-insensitively against
// source name or URL domain) are kept from the API aggregator.
// Everything else is skipped.

const ALLOWED_API_SOURCES: string[] = [
  'yahoo finance',
  'cnbc',
  'beincrypto',
  'the defiant',
  'thedefiant',
  'seekingalpha',
  'seeking alpha',
  'wu blockchain',
  'wublockchain',
  'x.com',
  'twitter',
];

/**
 * Check if an article comes from a source NOT on the allowlist.
 * Returns true if the source should be blocked.
 */
export function isBlockedSource(source: string | null | undefined, url: string): boolean {
  const lowerSource = (source || '').toLowerCase();
  const lowerUrl = url.toLowerCase();

  return !ALLOWED_API_SOURCES.some(
    (allowed) => lowerSource.includes(allowed) || lowerUrl.includes(allowed)
  );
}

/** Minimum extracted text length to justify spending LLM tokens on enrichment */
export const MIN_TEXT_FOR_ENRICHMENT = 200;

// ── Full-Text Search Utilities ────────────────────────────────────
export { sanitizeSearchQuery, detectLanguage, buildFTSQuery } from './search.js';

// ── Token Mapping Utilities ───────────────────────────────────────
export { TOKEN_TO_SANTIMENT_SLUG, getSantimentSlug, getSupportedTokenTags } from './token-mapping.js';
