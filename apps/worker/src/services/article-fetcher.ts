import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { createLogger, retryWithBackoff } from '@crypto-news/shared';

const logger = createLogger('worker:fetcher');

export interface FetchedArticle {
  rawHtml: string;
  extractedText: string;
  title?: string;
  byline?: string;
  excerpt?: string;
}

export interface FetcherOptions {
  userAgent: string;
  timeoutMs: number;
}

export class ArticleFetcher {
  private userAgent: string;
  private timeoutMs: number;

  constructor(options: FetcherOptions) {
    this.userAgent = options.userAgent;
    this.timeoutMs = options.timeoutMs;
  }

  async fetch(url: string): Promise<FetchedArticle> {
    logger.info({ url }, 'Fetching article');

    const rawHtml = await retryWithBackoff(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': this.userAgent,
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return await response.text();
        } finally {
          clearTimeout(timeout);
        }
      },
      {
        maxRetries: 3,
        baseDelayMs: 1000,
        onRetry: (error, attempt) => {
          logger.warn({ url, error: error.message, attempt }, 'Retrying article fetch');
        },
      }
    );

    // Parse with Readability
    const { extractedText, title, byline, excerpt } = this.extractContent(rawHtml, url);

    logger.info({ url, textLength: extractedText.length }, 'Article fetched and extracted');

    return {
      rawHtml,
      extractedText,
      title,
      byline,
      excerpt,
    };
  }

  private extractContent(
    html: string,
    url: string
  ): { extractedText: string; title?: string; byline?: string; excerpt?: string } {
    try {
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article || !article.textContent) {
        // Fallback: extract text from body
        return {
          extractedText: this.fallbackExtract(html),
        };
      }

      return {
        extractedText: article.textContent.trim(),
        title: article.title || undefined,
        byline: article.byline || undefined,
        excerpt: article.excerpt || undefined,
      };
    } catch (error) {
      logger.warn({ url, error: (error as Error).message }, 'Readability parsing failed, using fallback');
      return {
        extractedText: this.fallbackExtract(html),
      };
    }
  }

  private fallbackExtract(html: string): string {
    // Simple HTML stripping as fallback
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
}
