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
   * Detect category and sentiment from article title using expanded keyword matching
   */
  static detectFromTitle(title: string): { category: string; sentiment: 'positive' | 'negative' | 'neutral' } {
    const t = title.toLowerCase();
    let category = 'general';
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';

    // Category detection — ordered by specificity
    if (t.includes('etf') || t.includes('sec ') || t.includes('s.e.c')) {
      category = 'etf';
    } else if (
      t.includes('institution') || t.includes('bank') || t.includes('wall street') ||
      t.includes('blackrock') || t.includes('fidelity') || t.includes('vanguard') ||
      t.includes('jpmorgan') || t.includes('goldman') || t.includes('morgan stanley') ||
      t.includes('grayscale') || t.includes('apollo') || t.includes('citadel') ||
      t.includes('saylor') || t.includes('strategy') || t.includes('microstrategy') ||
      t.includes('coinbase') || t.includes('binance') || t.includes('kraken') ||
      t.includes('cz') || t.includes('changpeng') || t.includes('regulation') ||
      t.includes('treasury') || t.includes('federal reserve') || t.includes('fed ')
    ) {
      category = 'institutional';
    } else if (
      t.includes('bitcoin') || t.includes('btc') ||
      t.includes('halving') || t.includes('mining') || t.includes('miner') ||
      t.includes('satoshi') || t.includes('ordinals') || t.includes('bip-') ||
      t.includes('lightning network')
    ) {
      category = 'bitcoin';
    } else if (
      t.includes('ethereum') || t.includes('eth ') || t.includes('solana') ||
      t.includes('sol ') || t.includes('xrp') || t.includes('ripple') ||
      t.includes('cardano') || t.includes('polkadot') || t.includes('avalanche') ||
      t.includes('chainlink') || t.includes('polygon')
    ) {
      category = 'research'; // Major alts → MEDIUM
    } else if (
      t.includes('defi') || t.includes('decentralized') ||
      t.includes('lending') || t.includes('staking') || t.includes('yield') ||
      t.includes('swap') || t.includes('liquidity') || t.includes('amm') ||
      t.includes('aave') || t.includes('uniswap') || t.includes('morpho') ||
      t.includes('lido') || t.includes('maker')
    ) {
      category = 'defi';
    } else if (t.includes('nft') || t.includes('metaverse') || t.includes('gaming')) {
      category = 'nft';
    } else if (
      t.includes('research') || t.includes('analysis') || t.includes('report') ||
      t.includes('forecast') || t.includes('prediction') || t.includes('outlook')
    ) {
      category = 'research';
    } else if (
      t.includes('crypto') || t.includes('blockchain') || t.includes('token') ||
      t.includes('web3') || t.includes('dao') || t.includes('stablecoin') ||
      t.includes('usdt') || t.includes('usdc') || t.includes('cbdc') ||
      t.includes('payment') || t.includes('adoption') || t.includes('privacy') ||
      t.includes('hack') || t.includes('exploit') || t.includes('security') ||
      t.includes('whale') || t.includes('airdrop') || t.includes('layer 2') ||
      t.includes('l2') || t.includes('rollup') || t.includes('zk')
    ) {
      category = 'research'; // Crypto-related → MEDIUM
    }

    // Sentiment detection — expanded
    if (
      t.includes('bull') || t.includes('surge') || t.includes('rally') ||
      t.includes('gain') || t.includes('soar') || t.includes('jump') ||
      t.includes('record') || t.includes('all-time') ||
      t.includes('breakout') || t.includes('pump')
    ) {
      sentiment = 'positive';
    } else if (
      t.includes('bear') || t.includes('crash') || t.includes('dump') ||
      t.includes('lose') || t.includes('plunge') || t.includes('drop') ||
      t.includes('fall') || t.includes('fear') || t.includes('risk') ||
      t.includes('warn') || t.includes('threat') || t.includes('ban')
    ) {
      sentiment = 'negative';
    }

    return { category, sentiment };
  }

  /**
   * Map external enrichment to our schema
   * This is the main function to use!
   */
  static mapEnrichment(data: ExternalEnrichmentData, title?: string): MappedEnrichment {
    let sentiment = this.mapSentiment(data.externalSentiment);
    let category = data.externalCategory;

    // Enhance with title heuristics if data is weak
    if (title && (!category || category === 'general' || sentiment === 'NEUTRAL')) {
      const derived = this.detectFromTitle(title);

      // Override category if external is generic/missing but we found something specific
      if ((!category || category === 'general') && derived.category !== 'general') {
        category = derived.category;
      }

      // Override sentiment if external is neutral/missing but we found something specific
      if (sentiment === 'NEUTRAL' && derived.sentiment !== 'neutral') {
        sentiment = this.mapSentiment(derived.sentiment);
      }
    }

    const marketImpact = this.deriveMarketImpact(category, sentiment === 'BULLISH' ? 'positive' : sentiment === 'BEARISH' ? 'negative' : 'neutral');
    const tags = this.createTags(category, data.tickers);

    logger.debug(
      {
        input: data,
        title: title ? title.substring(0, 30) : undefined,
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
