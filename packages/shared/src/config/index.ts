import type { AppConfig, ChannelRouting, LLMProvider } from '../types/index.js';
import { TAG_VOCABULARY } from '../schemas/index.js';

// Default RSS feeds configuration
export const DEFAULT_RSS_FEEDS = [
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    enabled: true,
    category: 'general',
  },
  {
    name: 'CoinTelegraph',
    url: 'https://cointelegraph.com/rss',
    enabled: true,
    category: 'general',
  },
  {
    name: 'The Block',
    url: 'https://www.theblock.co/rss.xml',
    enabled: true,
    category: 'general',
  },
  {
    name: 'Decrypt',
    url: 'https://decrypt.co/feed',
    enabled: true,
    category: 'general',
  },
  {
    name: 'Bitcoin Magazine',
    url: 'https://bitcoinmagazine.com/feed',
    enabled: true,
    category: 'bitcoin',
  },
  {
    name: 'Blockworks',
    url: 'https://blockworks.co/feed/',
    enabled: true,
    category: 'general',
  },
  {
    name: 'CryptoSlate',
    url: 'https://cryptoslate.com/feed/',
    enabled: true,
    category: 'general',
  },
  {
    name: 'DeFi Pulse',
    url: 'https://defipulse.com/blog/feed/',
    enabled: true,
    category: 'defi',
  },
];

// Default channel routing - maps tags to Discord channels
export const DEFAULT_CHANNEL_ROUTING: ChannelRouting[] = [
  {
    channelId: process.env.DISCORD_CHANNEL_MARKET || '',
    channelName: 'market',
    tags: ['BTC', 'ETH', 'Altcoin', 'Solana', 'Exchange'],
  },
  {
    channelId: process.env.DISCORD_CHANNEL_MACRO || '',
    channelName: 'macro',
    tags: ['Macro', 'ETF'],
  },
  {
    channelId: process.env.DISCORD_CHANNEL_DEFI || '',
    channelName: 'defi',
    tags: ['DeFi', 'L2', 'Bridge', 'Stablecoin'],
  },
  {
    channelId: process.env.DISCORD_CHANNEL_POLICY || '',
    channelName: 'policy',
    tags: ['Regulation'],
  },
  {
    channelId: process.env.DISCORD_CHANNEL_NFT || '',
    channelName: 'nft-gaming',
    tags: ['NFT', 'Gaming', 'Memecoin'],
  },
  {
    channelId: process.env.DISCORD_CHANNEL_TECH || '',
    channelName: 'tech',
    tags: ['AI', 'Mining', 'DAO'],
  },
  {
    channelId: process.env.DISCORD_CHANNEL_SECURITY || '',
    channelName: 'security',
    tags: ['Hack'],
  },
  {
    channelId: process.env.DISCORD_DEFAULT_CHANNEL_ID || '',
    channelName: 'general',
    tags: [],
    isDefault: true,
  },
];

// Get environment variable with optional default
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOptional(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return num;
}

// Build app configuration from environment
export function buildConfig(): AppConfig {
  const llmProvider = (getEnvOptional('LLM_PROVIDER', 'openai') as LLMProvider) || 'openai';

  // Default model based on provider
  let defaultModel = 'gpt-4-turbo-preview';
  if (llmProvider === 'anthropic') {
    defaultModel = 'claude-3-sonnet-20240229';
  } else if (llmProvider === 'openrouter') {
    defaultModel = 'x-ai/grok-4-fast';
  }

  return {
    database: {
      url: getEnv('DATABASE_URL'),
    },
    redis: {
      url: getEnv('REDIS_URL', 'redis://localhost:6379'),
    },
    discord: {
      token: getEnvOptional('DISCORD_BOT_TOKEN') || '',
      guildId: getEnvOptional('DISCORD_GUILD_ID') || '',
      defaultChannelId: getEnvOptional('DISCORD_DEFAULT_CHANNEL_ID') || '',
      channelRouting: DEFAULT_CHANNEL_ROUTING.filter((r) => r.channelId),
    },
    llm: {
      provider: llmProvider,
      model: getEnv('LLM_MODEL', defaultModel),
      openaiApiKey: getEnvOptional('OPENAI_API_KEY'),
      anthropicApiKey: getEnvOptional('ANTHROPIC_API_KEY'),
      openrouterApiKey: getEnvOptional('OPENROUTER_API_KEY'),
    },
    fetcher: {
      userAgent: getEnv('FETCH_USER_AGENT', 'CryptoNewsBot/1.0'),
      timeoutMs: getEnvNumber('FETCH_TIMEOUT_MS', 30000),
    },
    worker: {
      concurrency: getEnvNumber('WORKER_CONCURRENCY', 3),
      fetchIntervalMinutes: getEnvNumber('FETCH_INTERVAL_MINUTES', 15),
      autoPostToDiscord: getEnvOptional('AUTO_POST_TO_DISCORD', 'false') === 'true',
      skipEnrichment: getEnvOptional('SKIP_ENRICHMENT', 'true') === 'true',
      enableHighImpactPosting: getEnvOptional('ENABLE_HIGH_IMPACT_POSTING', 'false') === 'true',
    },
    externalApis: {
      finnhub: {
        apiKey: getEnvOptional('FINNHUB_API_KEY'),
        enabled: getEnvOptional('ENABLE_EXTERNAL_SENTIMENT', 'false') === 'true',
      },
      fmp: {
        apiKey: getEnvOptional('FMP_API_KEY'),
        enabled: getEnvOptional('ENABLE_EXTERNAL_SENTIMENT', 'false') === 'true',
      },
      santiment: {
        apiKey: getEnvOptional('SANTIMENT_API_KEY'),
        enabled: getEnvOptional('ENABLE_ONCHAIN_METRICS', 'false') === 'true',
      },
    },
    api: {
      port: getEnvNumber('API_PORT', 3001),
      host: getEnvOptional('API_HOST', '0.0.0.0') || '0.0.0.0',
    },
    dashboard: {
      authSecret: getEnv('DASHBOARD_AUTH_SECRET', 'development-secret'),
    },
    logging: {
      level: getEnvOptional('LOG_LEVEL', 'info') || 'info',
    },
  };
}

// Tag vocabulary export
export { TAG_VOCABULARY };

// Channel routing helper
export function getChannelForTags(tags: string[], routing: ChannelRouting[]): string {
  // Find the first matching channel based on tags
  for (const route of routing) {
    if (route.isDefault) continue;
    const matchingTag = tags.find((tag) =>
      route.tags.some((routeTag) => routeTag.toLowerCase() === tag.toLowerCase())
    );
    if (matchingTag) {
      return route.channelId;
    }
  }

  // Return default channel
  const defaultRoute = routing.find((r) => r.isDefault);
  return defaultRoute?.channelId || '';
}

// Topic detection heuristics
export const TOPIC_KEYWORDS: Record<string, string[]> = {
  BTC: ['bitcoin', 'btc', 'satoshi', 'halving', 'btc/usd'],
  ETH: ['ethereum', 'eth', 'vitalik', 'eth2', 'beacon chain', 'eth/usd'],
  DeFi: ['defi', 'decentralized finance', 'yield', 'liquidity', 'amm', 'dex', 'lending', 'borrowing'],
  NFT: ['nft', 'non-fungible', 'opensea', 'blur', 'digital art', 'collectible'],
  Memecoin: ['memecoin', 'meme coin', 'doge', 'shiba', 'pepe', 'floki', 'bonk'],
  ETF: ['etf', 'exchange traded fund', 'blackrock', 'grayscale', 'spot bitcoin'],
  Macro: ['federal reserve', 'fed', 'interest rate', 'inflation', 'cpi', 'gdp', 'treasury', 'yield curve'],
  Regulation: ['sec', 'regulation', 'compliance', 'lawsuit', 'legal', 'court', 'ban', 'cbdc', 'congress', 'senate'],
  L2: ['layer 2', 'l2', 'rollup', 'optimism', 'arbitrum', 'zksync', 'base', 'polygon', 'scaling'],
  AI: ['artificial intelligence', 'ai', 'machine learning', 'gpt', 'llm', 'ai crypto'],
  Stablecoin: ['stablecoin', 'usdt', 'usdc', 'tether', 'circle', 'dai', 'peg'],
  Exchange: ['binance', 'coinbase', 'kraken', 'ftx', 'exchange', 'cex', 'trading volume'],
  Mining: ['mining', 'miner', 'hashrate', 'hash rate', 'proof of work', 'asic'],
  Hack: ['hack', 'exploit', 'security breach', 'stolen', 'vulnerability', 'attack', 'drain'],
  Airdrop: ['airdrop', 'token distribution', 'claim', 'free tokens'],
  Solana: ['solana', 'sol', 'phantom', 'raydium', 'jupiter'],
  Gaming: ['gamefi', 'play to earn', 'p2e', 'gaming', 'metaverse', 'virtual world'],
  DAO: ['dao', 'decentralized autonomous', 'governance', 'voting', 'proposal'],
  Bridge: ['bridge', 'cross-chain', 'interoperability', 'multichain', 'wormhole'],
  Altcoin: ['altcoin', 'alt season'],
};

// Detect tags from text using keyword matching
export function detectTagsFromText(text: string): string[] {
  const lowerText = text.toLowerCase();
  const detectedTags: string[] = [];

  for (const [tag, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        if (!detectedTags.includes(tag)) {
          detectedTags.push(tag);
        }
        break;
      }
    }
  }

  return detectedTags;
}
