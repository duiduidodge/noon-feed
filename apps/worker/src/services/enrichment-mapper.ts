import { createLogger } from '@crypto-news/shared';

const logger = createLogger('worker:enrichment-mapper');

export interface ExternalEnrichmentData {
  externalSentiment?: string; // 'positive' | 'negative' | 'neutral'
  externalCategory?: string; // 'bitcoin' | 'defi' | 'institutional' | 'etf' | 'nft' | 'general' | 'research'
  tickers?: string[];
}

export interface MappedEnrichment {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  marketImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  tags: string[];
}

/**
 * Map external enrichment data from cryptocurrency.cv to our schema
 * This is FREE - no LLM calls required!
 */
export class EnrichmentMapper {
  /**
   * Map sentiment from external API to our format
   */
  private static mapSentiment(externalSentiment?: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    switch (externalSentiment?.toLowerCase()) {
      case 'positive':
        return 'BULLISH';
      case 'negative':
        return 'BEARISH';
      case 'neutral':
      default:
        return 'NEUTRAL';
    }
  }

  /**
   * Derive market impact from category + sentiment
   *
   * Rules:
   * - institutional, etf → Always HIGH (regulatory/institutional = high impact)
   * - bitcoin + positive → HIGH
   * - bitcoin + negative/neutral → MEDIUM
   * - research → MEDIUM
   * - defi → MEDIUM
   * - nft, general → LOW
   */
  private static deriveMarketImpact(
    category?: string,
    sentiment?: string
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    const cat = category?.toLowerCase();
    const sent = sentiment?.toLowerCase();

    // High-impact categories (always HIGH regardless of sentiment)
    if (cat === 'institutional' || cat === 'etf') {
      return 'HIGH';
    }

    // Bitcoin news
    if (cat === 'bitcoin') {
      return sent === 'positive' ? 'HIGH' : 'MEDIUM';
    }

    // Medium-impact categories
    if (cat === 'research' || cat === 'defi') {
      return 'MEDIUM';
    }

    // Low-impact categories
    return 'LOW';
  }

  /**
   * Create tags from category and tickers
   */
  private static createTags(category?: string, tickers?: string[]): string[] {
    const tags: string[] = [];

    // Add category as tag (capitalized)
    if (category) {
      const categoryTag = category.toUpperCase();
      // Map to our tag vocabulary
      switch (categoryTag) {
        case 'BITCOIN':
          tags.push('BTC', 'Bitcoin');
          break;
        case 'DEFI':
          tags.push('DeFi');
          break;
        case 'INSTITUTIONAL':
          tags.push('Institutional', 'Adoption');
          break;
        case 'ETF':
          tags.push('ETF', 'Regulation');
          break;
        case 'NFT':
          tags.push('NFT');
          break;
        case 'RESEARCH':
          tags.push('Analysis');
          break;
        default:
          // Don't add 'general' as a tag
          break;
      }
    }

    // Add ticker tags
    if (tickers && tickers.length > 0) {
      tickers.forEach((ticker) => {
        const upperTicker = ticker.toUpperCase();
        if (!tags.includes(upperTicker)) {
          tags.push(upperTicker);
        }
      });
    }

    return tags;
  }

  /**
   * Map external enrichment to our schema
   * This is the main function to use!
   */
  static mapEnrichment(data: ExternalEnrichmentData): MappedEnrichment {
    const sentiment = this.mapSentiment(data.externalSentiment);
    const marketImpact = this.deriveMarketImpact(data.externalCategory, data.externalSentiment);
    const tags = this.createTags(data.externalCategory, data.tickers);

    logger.debug(
      {
        input: data,
        output: { sentiment, marketImpact, tags },
      },
      'Mapped external enrichment'
    );

    return {
      sentiment,
      marketImpact,
      tags,
    };
  }
}
