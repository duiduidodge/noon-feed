import { createLogger, RateLimiter } from '@crypto-news/shared';

const logger = createLogger('worker:onchain:santiment');

export interface SantimentMetrics {
  slug: string;
  socialVolume?: number;          // Social mentions volume
  devActivity?: number;           // Development activity (GitHub commits)
  whaleTransactionCount?: number; // Number of whale transactions
  activeAddresses?: number;       // Number of active addresses
  exchangeInflow?: number;        // Inflow to exchanges
  exchangeOutflow?: number;       // Outflow from exchanges
  timestamp: string;              // ISO timestamp of data
}

/**
 * Santiment On-Chain Metrics Provider
 * Fetches on-chain data from Santiment API
 * Free tier: ~100 queries/day, limited to major tokens
 */
export class SantimentProvider {
  private apiKey: string;
  private rateLimiter: RateLimiter;
  private baseUrl = 'https://api.santiment.net/graphql';
  private cache: Map<string, { data: SantimentMetrics; timestamp: number }> = new Map();
  private readonly cacheDuration = 600000; // 10 minutes in ms

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // Rate limit: 100/day = ~1 per 15 minutes, be conservative
    this.rateLimiter = new RateLimiter(100, 0.001157); // ~100 per day
  }

  /**
   * Fetch on-chain metrics for a token slug
   * @param slug - Santiment slug (e.g., 'bitcoin', 'ethereum')
   * @returns Metrics data or null if unavailable
   */
  async fetchMetrics(slug: string): Promise<SantimentMetrics | null> {
    if (!this.apiKey || this.apiKey === '') {
      logger.warn('Santiment API key not configured, skipping');
      return null;
    }

    // Check cache first
    const cached = this.cache.get(slug);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      logger.debug({ slug }, 'Returning cached Santiment metrics');
      return cached.data;
    }

    try {
      await this.rateLimiter.acquire(1);

      // GraphQL query for multiple metrics
      const query = `
        query($slug: String!, $from: DateTime!, $to: DateTime!) {
          getMetric(metric: "social_volume_total") {
            timeseriesData(
              slug: $slug
              from: $from
              to: $to
              interval: "1d"
            ) {
              datetime
              value
            }
          }
          devActivity: getMetric(metric: "dev_activity") {
            timeseriesData(
              slug: $slug
              from: $from
              to: $to
              interval: "1d"
            ) {
              datetime
              value
            }
          }
          activeAddresses: getMetric(metric: "active_addresses_24h") {
            timeseriesData(
              slug: $slug
              from: $from
              to: $to
              interval: "1d"
            ) {
              datetime
              value
            }
          }
        }
      `;

      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);

      const variables = {
        slug,
        from: yesterday.toISOString(),
        to: now.toISOString(),
      };

      logger.debug({ slug }, 'Fetching Santiment metrics');

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Apikey ${this.apiKey}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn('Santiment rate limit exceeded');
          return null;
        }
        throw new Error(`Santiment API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.errors) {
        logger.warn({ errors: result.errors, slug }, 'Santiment API returned errors');
        return null;
      }

      if (!result.data) {
        logger.warn({ slug }, 'No data from Santiment');
        return null;
      }

      // Extract latest values from timeseries
      const socialVolume = result.data.getMetric?.timeseriesData?.[0]?.value;
      const devActivity = result.data.devActivity?.timeseriesData?.[0]?.value;
      const activeAddresses = result.data.activeAddresses?.timeseriesData?.[0]?.value;

      const metrics: SantimentMetrics = {
        slug,
        socialVolume: socialVolume ? parseFloat(socialVolume) : undefined,
        devActivity: devActivity ? parseFloat(devActivity) : undefined,
        activeAddresses: activeAddresses ? parseFloat(activeAddresses) : undefined,
        timestamp: new Date().toISOString(),
      };

      // Cache the result
      this.cache.set(slug, { data: metrics, timestamp: Date.now() });

      logger.info({ slug, metrics }, 'Santiment metrics fetched');

      return metrics;
    } catch (error) {
      logger.error({ error: (error as Error).message, slug }, 'Failed to fetch Santiment metrics');
      return null;
    }
  }

  /**
   * Detect significant on-chain activity
   * @param current - Current metrics
   * @param baseline - Baseline metrics (historical average)
   * @returns Array of detected signals
   */
  detectSignificantActivity(
    current: SantimentMetrics,
    baseline?: SantimentMetrics
  ): string[] {
    const signals: string[] = [];

    if (!baseline) return signals;

    // Whale activity (>2x baseline)
    if (
      current.whaleTransactionCount &&
      baseline.whaleTransactionCount &&
      current.whaleTransactionCount > baseline.whaleTransactionCount * 2
    ) {
      signals.push('whale_activity');
    }

    // Social volume spike (>3x baseline)
    if (
      current.socialVolume &&
      baseline.socialVolume &&
      current.socialVolume > baseline.socialVolume * 3
    ) {
      signals.push('social_spike');
    }

    // Development activity increase (>1.5x baseline)
    if (
      current.devActivity &&
      baseline.devActivity &&
      current.devActivity > baseline.devActivity * 1.5
    ) {
      signals.push('dev_activity_increase');
    }

    return signals;
  }
}
