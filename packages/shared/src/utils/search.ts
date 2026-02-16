/**
 * Full-Text Search Utilities
 * Provides functions for PostgreSQL FTS query sanitization and language detection
 */

/**
 * Sanitize search query to prevent SQL injection
 * Removes special characters that could break PostgreSQL FTS queries
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    return '';
  }

  return query
    .trim()
    // Remove potential SQL injection characters
    .replace(/[';-]/g, '')
    // Remove special FTS operators that users shouldn't use directly
    .replace(/[&|!<>()]/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect if query is Thai, English, or auto (mixed)
 * Thai Unicode range: \u0E00-\u0E7F
 */
export function detectLanguage(query: string): 'en' | 'th' | 'auto' {
  if (!query || typeof query !== 'string') {
    return 'auto';
  }

  const thaiCharRegex = /[\u0E00-\u0E7F]/;
  const englishCharRegex = /[a-zA-Z]/;

  const hasThai = thaiCharRegex.test(query);
  const hasEnglish = englishCharRegex.test(query);

  if (hasThai && hasEnglish) {
    return 'auto'; // Mixed language
  } else if (hasThai) {
    return 'th';
  } else if (hasEnglish) {
    return 'en';
  }

  return 'auto'; // No recognizable characters, search both
}

/**
 * Build PostgreSQL FTS query from user input
 * Returns a string safe for use with plainto_tsquery
 */
export function buildFTSQuery(query: string): string {
  return sanitizeSearchQuery(query);
}
