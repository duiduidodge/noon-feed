import { createLogger, RateLimiter } from '@crypto-news/shared';

const logger = createLogger('worker:sentiment:finnhub');

export interface FinnhubSentiment {
  symbol: string;
  sentiment: {
    bearish: number;   // 0.0-1.0
    bullish: number;   // 0.0-1.0
  };
  score: number;       // Normalized -1 to 1 (bearish to bullish)
  buzz: {
    articlesInLastWeek: number;
    weeklyAverage: number;
  };
}

/**
 * Finnhub Sentiment Provider
 * Fetches news sentiment data from Finnhub API
 * Free tier: 60 calls/min
 */
export class FinnhubSentimentProvider {
  private apiKey: string;
  private rateLimiter: RateLimiter;
  private baseUrl = 'https://finnhub.io/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // Rate limit: 60/min = 1/second
    this.rateLimiter = new RateLimiter(60, 1);
  }

  /**
   * Fetch sentiment for a crypto symbol
   * @param symbol - Crypto symbol (e.g., 'BTCUSD', 'ETHUSD')
   * @returns Sentiment data or null if unavailable
   */
  async fetchSentiment(symbol: string): Promise<FinnhubSentiment | null> {
    if (!this.apiKey || this.apiKey === '') {
      logger.warn('Finnhub API key not configured, skipping');
      return null;
    }

    try {
      await this.rateLimiter.acquire(1);

      const url = new URL(`${this.baseUrl}/news-sentiment`);
      url.searchParams.append('symbol', `CRYPTO:${symbol}`);
      url.searchParams.append('token', this.apiKey);

      logger.debug({ symbol }, 'Fetching Finnhub sentiment');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn('Finnhub rate limit exceeded');
          return null;
        }
        throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Finnhub returns: { sentiment: { bearish, bullish }, buzz: { ... } }
      if (!data.sentiment) {
        logger.warn({ symbol }, 'No sentiment data from Finnhub');
        return null;
      }

      const { bearish = 0, bullish = 0 } = data.sentiment;

      // Normalize to -1 (bearish) to 1 (bullish)
      const total = bearish + bullish;
      const score = total > 0 ? (bullish - bearish) / total : 0;

      logger.info({ symbol, score, bearish, bullish }, 'Finnhub sentiment fetched');

      return {
        symbol,
        sentiment: {
          bearish,
          bullish,
        },
        score,
        buzz: {
          articlesInLastWeek: data.buzz?.articlesInLastWeek || 0,
          weeklyAverage: data.buzz?.weeklyAverage || 0,
        },
      };
    } catch (error) {
      logger.error({ error: (error as Error).message, symbol }, 'Failed to fetch Finnhub sentiment');
      return null;
    }
  }

  /**
   * Map crypto tag to Finnhub symbol
   */
  static mapTagToSymbol(tag: string): string | null {
    const mapping: Record<string, string> = {
      'BTC': 'BTCUSD',
      'Bitcoin': 'BTCUSD',
      'ETH': 'ETHUSD',
      'Ethereum': 'ETHUSD',
      'SOL': 'SOLUSD',
      'Solana': 'SOLUSD',
      'HYPE': 'HYPEUSD',
      'XRP': 'XRPUSD',
      'Ripple': 'XRPUSD',
      'ADA': 'ADAUSD',
      'Cardano': 'ADAUSD',
      'DOGE': 'DOGEUSD',
      'Dogecoin': 'DOGEUSD',
      'MATIC': 'MATICUSD',
      'Polygon': 'MATICUSD',
      'AVAX': 'AVAXUSD',
      'Avalanche': 'AVAXUSD',
      'DOT': 'DOTUSD',
      'Polkadot': 'DOTUSD',
      'LINK': 'LINKUSD',
      'Chainlink': 'LINKUSD',
    };

    return mapping[tag] || null;
  }
}
