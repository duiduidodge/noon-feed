import { createLogger, retryWithBackoff } from '@crypto-news/shared';

const logger = createLogger('worker:api-news-fetcher');

// cryptocurrency.cv API types
interface APINewsItem {
  title: string;
  link: string;
  url?: string; // cryptocurrency.cv uses 'url' instead of 'link'
  description?: string;
  pubDate: string;
  publishedAt?: string; // cryptocurrency.cv uses 'publishedAt'
  source: string;
  sourceKey?: string;
  category?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  image?: string;
  tickers?: string[];
}

interface APINewsResponse {
  articles: APINewsItem[];
  totalCount: number;
  sources?: string[];
  fetchedAt?: string;
}

export interface FetchedAPINews {
  title: string;
  url: string;
  publishedAt: Date;
  source: string;
  sentiment?: string;
  summary?: string;
  tickers?: string[];
  enrichmentData?: {
    externalSentiment?: string;
    externalCategory?: string;
  };
}

export class APINewsFetcher {
  private baseUrl: string;
  private userAgent: string;
  private timeoutMs: number;

  constructor(options: {
    baseUrl?: string;
    userAgent: string;
    timeoutMs: number;
  }) {
    this.baseUrl = options.baseUrl || 'https://cryptocurrency.cv';
    this.userAgent = options.userAgent;
    this.timeoutMs = options.timeoutMs;
  }

  withBaseUrl(baseUrl: string): APINewsFetcher {
    return new APINewsFetcher({
      baseUrl,
      userAgent: this.userAgent,
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Fetch latest news from the API
   */
  async fetchLatestNews(options: {
    limit?: number;
    since?: Date;
    tickers?: string[];
    categories?: string[];
    language?: string;
  } = {}): Promise<FetchedAPINews[]> {
    const {
      limit = 50, // Reasonable default for quality over quantity
      since,
      tickers,
      categories,
      language
    } = options;

    return retryWithBackoff(
      async () => {
        logger.info({ limit, since, tickers, language }, 'Fetching latest news from API');

        // Build query params
        const params = new URLSearchParams();
        params.set('limit', limit.toString());

        if (since) {
          params.set('since', since.toISOString());
        }

        if (tickers && tickers.length > 0) {
          for (const ticker of tickers) {
            params.append('ticker', ticker);
          }
        }

        if (categories && categories.length > 0) {
          for (const category of categories) {
            params.append('category', category);
          }
        }

        if (language) {
          params.set('lang', language);
        }

        const url = `${this.baseUrl}/api/news?${params.toString()}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': this.userAgent,
              'Accept': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json() as APINewsResponse;

          logger.info(
            { count: data.articles.length, total: data.totalCount },
            'Fetched news from API'
          );

          // Transform API response to our format
          return data.articles.map((item) => ({
            title: item.title,
            url: item.url || item.link, // cryptocurrency.cv uses 'url', fallback to 'link'
            publishedAt: new Date(item.publishedAt || item.pubDate),
            source: item.source,
            sentiment: item.sentiment, // preserve for enrichment mapping
            summary: item.description,
            tickers: item.tickers,
            // Store enrichment metadata for later use
            enrichmentData: {
              externalSentiment: item.sentiment,
              externalCategory: item.category,
            },
          }));
        } catch (error: any) {
          clearTimeout(timeout);
          if (error.name === 'AbortError') {
            throw new Error(`API request timeout after ${this.timeoutMs}ms`);
          }
          throw error;
        }
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000,
        onRetry: (error, attempt) => {
          logger.warn({ error: error.message, attempt }, 'Retrying API news fetch');
        },
      }
    );
  }

  /**
   * Fetch sentiment analysis for a URL (optional enhancement)
   */
  async fetchSentiment(url: string): Promise<{ sentiment: string; confidence: number } | null> {
    try {
      const params = new URLSearchParams({ url });
      const response = await fetch(`${this.baseUrl}/api/ai/sentiment?${params.toString()}`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        sentiment: data.sentiment || 'neutral',
        confidence: data.confidence || 0,
      };
    } catch (error) {
      logger.warn({ error: (error as Error).message, url }, 'Failed to fetch sentiment');
      return null;
    }
  }

  /**
   * Search historical news
   */
  async searchArchive(query: {
    text?: string;
    tickers?: string[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<FetchedAPINews[]> {
    const { text, tickers, startDate, endDate, limit = 50 } = query;

    return retryWithBackoff(
      async () => {
        logger.info({ query }, 'Searching archive');

        const params = new URLSearchParams();
        params.set('limit', limit.toString());

        if (text) params.set('q', text);
        if (tickers) params.set('tickers', tickers.join(','));
        if (startDate) params.set('start', startDate.toISOString().split('T')[0]);
        if (endDate) params.set('end', endDate.toISOString().split('T')[0]);

        const url = `${this.baseUrl}/api/archive?${params.toString()}`;

        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as APINewsResponse;

        return data.articles.map((item) => ({
          title: item.title,
          url: item.link,
          publishedAt: new Date(item.pubDate),
          source: item.source,
          sentiment: item.sentiment,
          summary: item.description,
          tickers: item.tickers,
        }));
      },
      {
        maxRetries: 2,
        baseDelayMs: 1000,
      }
    );
  }
}
