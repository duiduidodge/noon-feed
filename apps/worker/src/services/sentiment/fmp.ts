import { createLogger } from '@crypto-news/shared';

const logger = createLogger('worker:sentiment:fmp');

export interface FMPSentiment {
  symbol: string;
  sentiment: number;     // -1 to 1 (bearish to bullish)
  label: string;         // 'Bearish', 'Neutral', 'Bullish'
  mentions: number;      // Social mentions count
}

/**
 * Financial Modeling Prep Sentiment Provider
 * Fetches social sentiment data from FMP API
 * Free tier: 250 calls/day
 */
export class FMPSentimentProvider {
  private apiKey: string;
  private baseUrl = 'https://financialmodelingprep.com/api/v4';
  private callCount = 0;
  private lastReset = Date.now();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetch sentiment for a crypto ticker
   * @param ticker - Ticker symbol (e.g., 'BTCUSD', 'ETHUSD')
   * @returns Sentiment data or null if unavailable
   */
  async fetchSentiment(ticker: string): Promise<FMPSentiment | null> {
    if (!this.apiKey || this.apiKey === '') {
      logger.warn('FMP API key not configured, skipping');
      return null;
    }

    // Reset daily counter
    const now = Date.now();
    if (now - this.lastReset > 86400000) { // 24 hours
      this.callCount = 0;
      this.lastReset = now;
    }

    // Check daily limit (250 calls/day on free tier)
    if (this.callCount >= 250) {
      logger.warn('FMP daily API limit reached (250/day)');
      return null;
    }

    try {
      const url = new URL(`${this.baseUrl}/historical/social-sentiment`);
      url.searchParams.append('symbol', ticker);
      url.searchParams.append('apikey', this.apiKey);

      logger.debug({ ticker }, 'Fetching FMP sentiment');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      this.callCount++;

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn('FMP rate limit exceeded');
          return null;
        }
        throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // FMP returns array of historical data, take most recent
      if (!Array.isArray(data) || data.length === 0) {
        logger.warn({ ticker }, 'No sentiment data from FMP');
        return null;
      }

      const latest = data[0];

      // Parse sentiment score and label
      const sentimentScore = parseFloat(latest.sentimentScore || '0');
      const normalizedScore = Math.max(-1, Math.min(1, sentimentScore / 100)); // Normalize to -1..1

      let label = 'Neutral';
      if (normalizedScore > 0.3) label = 'Bullish';
      else if (normalizedScore < -0.3) label = 'Bearish';

      logger.info({ ticker, score: normalizedScore, label }, 'FMP sentiment fetched');

      return {
        symbol: ticker,
        sentiment: normalizedScore,
        label,
        mentions: parseInt(latest.mentions || '0', 10),
      };
    } catch (error) {
      logger.error({ error: (error as Error).message, ticker }, 'Failed to fetch FMP sentiment');
      return null;
    }
  }

  /**
   * Map crypto tag to FMP ticker
   * FMP uses different format than Finnhub
   */
  static mapTagToTicker(tag: string): string | null {
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
    };

    return mapping[tag] || null;
  }
}
