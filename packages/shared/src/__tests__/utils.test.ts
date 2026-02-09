import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  createArticleHash,
  calculateTitleSimilarity,
  isDuplicateArticle,
  truncate,
  stripHtml,
  chunk,
} from '../utils/index.js';

describe('normalizeUrl', () => {
  it('should remove tracking parameters', () => {
    const url = 'https://example.com/article?utm_source=twitter&utm_medium=social&id=123';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('https://example.com/article?id=123');
  });

  it('should remove www prefix', () => {
    const url = 'https://www.example.com/article';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('https://example.com/article');
  });

  it('should remove trailing slashes', () => {
    const url = 'https://example.com/article/';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('https://example.com/article');
  });

  it('should lowercase the URL', () => {
    const url = 'https://EXAMPLE.COM/Article';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('https://example.com/article');
  });

  it('should sort query parameters', () => {
    const url = 'https://example.com?z=1&a=2&m=3';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('https://example.com/?a=2&m=3&z=1');
  });
});

describe('createArticleHash', () => {
  it('should create consistent hash for same inputs', () => {
    const hash1 = createArticleHash('Title', 'https://example.com', new Date('2024-01-01'));
    const hash2 = createArticleHash('Title', 'https://example.com', new Date('2024-01-01'));
    expect(hash1).toBe(hash2);
  });

  it('should create different hashes for different titles', () => {
    const hash1 = createArticleHash('Title 1', 'https://example.com', new Date('2024-01-01'));
    const hash2 = createArticleHash('Title 2', 'https://example.com', new Date('2024-01-01'));
    expect(hash1).not.toBe(hash2);
  });

  it('should handle missing date', () => {
    const hash = createArticleHash('Title', 'https://example.com');
    expect(hash).toBeTruthy();
  });
});

describe('calculateTitleSimilarity', () => {
  it('should return 1 for identical titles', () => {
    const similarity = calculateTitleSimilarity('Bitcoin hits new high', 'Bitcoin hits new high');
    expect(similarity).toBe(1);
  });

  it('should return 1 for case-insensitive identical titles', () => {
    const similarity = calculateTitleSimilarity('Bitcoin Hits New High', 'bitcoin hits new high');
    expect(similarity).toBe(1);
  });

  it('should return high similarity for similar titles', () => {
    const similarity = calculateTitleSimilarity(
      'Bitcoin hits new all-time high',
      'Bitcoin hits new all time high'
    );
    expect(similarity).toBeGreaterThan(0.9);
  });

  it('should return low similarity for different titles', () => {
    const similarity = calculateTitleSimilarity(
      'Bitcoin hits new high',
      'Ethereum drops 10 percent'
    );
    expect(similarity).toBeLessThan(0.5);
  });

  it('should handle empty strings', () => {
    // Two empty strings are identical, so similarity is 1
    expect(calculateTitleSimilarity('', '')).toBe(1);
    expect(calculateTitleSimilarity('Title', '')).toBe(0);
  });
});

describe('isDuplicateArticle', () => {
  it('should detect URL duplicates', () => {
    const existing = {
      titleOriginal: 'Different Title',
      urlNormalized: 'https://example.com/article',
    };
    const incoming = {
      title: 'Some Title',
      url: 'https://www.example.com/article/',
    };
    expect(isDuplicateArticle(existing, incoming)).toBe(true);
  });

  it('should detect title similarity duplicates', () => {
    const existing = {
      titleOriginal: 'Bitcoin hits new all-time high of $100K',
      urlNormalized: 'https://example.com/article-1',
    };
    const incoming = {
      title: 'Bitcoin hits new all-time high of $100,000',
      url: 'https://different.com/article-2',
    };
    expect(isDuplicateArticle(existing, incoming)).toBe(true);
  });

  it('should not flag different articles as duplicates', () => {
    const existing = {
      titleOriginal: 'Bitcoin analysis for January',
      urlNormalized: 'https://example.com/article-1',
    };
    const incoming = {
      title: 'Ethereum price prediction for February',
      url: 'https://different.com/article-2',
    };
    expect(isDuplicateArticle(existing, incoming)).toBe(false);
  });
});

describe('truncate', () => {
  it('should not truncate short text', () => {
    const text = 'Short text';
    expect(truncate(text, 20)).toBe('Short text');
  });

  it('should truncate long text with ellipsis', () => {
    const text = 'This is a very long text that needs to be truncated';
    expect(truncate(text, 20)).toBe('This is a very lo...');
    expect(truncate(text, 20).length).toBe(20);
  });
});

describe('stripHtml', () => {
  it('should remove HTML tags', () => {
    const html = '<p>Hello <strong>World</strong></p>';
    expect(stripHtml(html)).toBe('Hello World');
  });

  it('should remove script tags and content', () => {
    const html = '<p>Text</p><script>alert("xss")</script><p>More</p>';
    expect(stripHtml(html)).toBe('Text More');
  });

  it('should decode HTML entities', () => {
    const html = '&lt;Hello&gt; &amp; &quot;World&quot;';
    expect(stripHtml(html)).toBe('<Hello> & "World"');
  });
});

describe('chunk', () => {
  it('should split array into chunks', () => {
    const array = [1, 2, 3, 4, 5];
    expect(chunk(array, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('should handle empty array', () => {
    expect(chunk([], 2)).toEqual([]);
  });

  it('should handle array smaller than chunk size', () => {
    const array = [1, 2];
    expect(chunk(array, 5)).toEqual([[1, 2]]);
  });
});
