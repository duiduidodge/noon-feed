/**
 * Token Tag to Santiment Slug Mapping
 * Maps crypto tags used in articles to Santiment API slugs
 */

export const TOKEN_TO_SANTIMENT_SLUG: Record<string, string> = {
  // Bitcoin
  'BTC': 'bitcoin',
  'Bitcoin': 'bitcoin',

  // Ethereum
  'ETH': 'ethereum',
  'Ethereum': 'ethereum',

  // Solana
  'SOL': 'solana',
  'Solana': 'solana',

  // XRP / Ripple
  'XRP': 'ripple',
  'Ripple': 'ripple',

  // Cardano
  'ADA': 'cardano',
  'Cardano': 'cardano',

  // Dogecoin
  'DOGE': 'dogecoin',
  'Dogecoin': 'dogecoin',

  // Polygon
  'MATIC': 'polygon',
  'Polygon': 'polygon',

  // Polkadot
  'DOT': 'polkadot',
  'Polkadot': 'polkadot',

  // Avalanche
  'AVAX': 'avalanche',
  'Avalanche': 'avalanche',

  // Chainlink
  'LINK': 'chainlink',
  'Chainlink': 'chainlink',

  // Litecoin
  'LTC': 'litecoin',
  'Litecoin': 'litecoin',

  // Uniswap
  'UNI': 'uniswap',
  'Uniswap': 'uniswap',

  // Cosmos
  'ATOM': 'cosmos',
  'Cosmos': 'cosmos',

  // Stellar
  'XLM': 'stellar',
  'Stellar': 'stellar',

  // Tron
  'TRX': 'tron',
  'Tron': 'tron',

  // Binance Coin
  'BNB': 'binance-coin',
  'Binance Coin': 'binance-coin',

  // Shiba Inu
  'SHIB': 'shiba-inu',
  'Shiba Inu': 'shiba-inu',

  // Hyperliquid (if available)
  'HYPE': 'hyperliquid',
  'Hyperliquid': 'hyperliquid',
};

/**
 * Get Santiment slug for a given token tag
 * @param tag - Token tag (e.g., 'BTC', 'Ethereum')
 * @returns Santiment slug or null if not found
 */
export function getSantimentSlug(tag: string): string | null {
  return TOKEN_TO_SANTIMENT_SLUG[tag] || null;
}

/**
 * Get all supported token tags
 */
export function getSupportedTokenTags(): string[] {
  return Object.keys(TOKEN_TO_SANTIMENT_SLUG);
}
