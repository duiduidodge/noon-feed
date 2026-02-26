// Core types for the Crypto News Bot system

export type Sentiment = 'bullish' | 'bearish' | 'neutral';
export type MarketImpact = 'high' | 'medium' | 'low';
export type ArticleStatus = 'PENDING' | 'FETCHED' | 'ENRICHED' | 'FAILED' | 'SKIPPED';
export type PostingStatus = 'PENDING' | 'POSTED' | 'FAILED';
export type SourceType = 'RSS' | 'API' | 'MANUAL';
export type LLMProvider = 'openai' | 'anthropic' | 'openrouter';

// Note: EnrichmentOutput type is defined in schemas/index.ts (derived from Zod schema)

// Source configuration
export interface SourceConfig {
  id?: string;
  name: string;
  type: SourceType;
  url: string;
  enabled: boolean;
  category?: string;
}

// RSS Feed item
export interface RSSItem {
  title: string;
  link: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
  isoDate?: string;
  creator?: string;
  categories?: string[];
}

// Parsed article for processing
export interface ParsedArticle {
  sourceId: string;
  sourceName: string;
  url: string;
  title: string;
  publishedAt?: Date;
  rawContent?: string;
}

// Article with enrichment for display
export interface ArticleWithEnrichment {
  id: string;
  sourceId: string;
  sourceName: string;
  url: string;
  urlNormalized: string;
  titleOriginal: string;
  publishedAt: Date | null;
  fetchedAt: Date;
  extractedText: string | null;
  status: ArticleStatus;
  enrichment?: {
    id: string;
    titleTh: string;
    summaryTh: string;
    tags: string[];
    sentiment: Sentiment;
    marketImpact: MarketImpact;
    contentDraftTh?: string | null;
    cautions?: string[];
    mustQuote?: string[];
    llmModel: string;
    llmProvider: string;
  } | null;
  postings: {
    id: string;
    discordChannelId: string;
    postedAt: Date | null;
    status: PostingStatus;
  }[];
}

// Discord channel routing configuration
export interface ChannelRouting {
  channelId: string;
  channelName: string;
  tags: string[];
  isDefault?: boolean;
}

// Discord post format
export interface DiscordPostContent {
  title: string;
  titleTh: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  tags: string[];
  sentiment: Sentiment;
  marketImpact: MarketImpact;
}

// API response types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ArticleFilters {
  sourceId?: string;
  tags?: string[];
  sentiment?: Sentiment;
  marketImpact?: MarketImpact;
  status?: ArticleStatus;
  posted?: boolean;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

// Job types
export type JobType =
  | 'FETCH_RSS'
  | 'FETCH_ARTICLE'
  | 'ENRICH_ARTICLE'
  | 'POST_DISCORD'
  | 'MANUAL_INGEST';

export interface JobPayload {
  articleId?: string;
  sourceId?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

// Export format for CSV
export interface ExportRow {
  title_th: string;
  summary_th: string;
  content_draft_th: string;
  url: string;
  source: string;
  publishedAt: string;
  tags: string;
  sentiment: string;
  marketImpact: string;
}

// LLM provider interface
export interface LLMProviderInterface {
  name: LLMProvider;
  complete(prompt: string, options?: LLMOptions): Promise<string>;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

// Config types
export interface AppConfig {
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  discord: {
    token: string;
    guildId: string;
    defaultChannelId: string;
    channelRouting: ChannelRouting[];
  };
  llm: {
    provider: LLMProvider;
    model: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    openrouterApiKey?: string;
  };
  fetcher: {
    userAgent: string;
    timeoutMs: number;
  };
  worker: {
    concurrency: number;
    fetchIntervalMinutes: number;
    autoPostToDiscord: boolean;
    skipEnrichment: boolean;
    enableHighImpactPosting: boolean;
    enableEmergingMoversSignals: boolean;
    emergingMoversCommand?: string;
    emergingMoversIntervalSeconds: number;
    enableOpportunitySignals: boolean;
    opportunitySignalsCommand?: string;
    opportunitySignalsIntervalSeconds: number;
    enableWhaleSignals: boolean;
    whaleSignalsIntervalSeconds: number;
    whaleRiskProfile: 'conservative' | 'moderate' | 'aggressive';
  };
  externalApis: {
    finnhub: {
      apiKey?: string;
      enabled: boolean;
    };
    fmp: {
      apiKey?: string;
      enabled: boolean;
    };
    santiment: {
      apiKey?: string;
      enabled: boolean;
    };
  };
  api: {
    port: number;
    host: string;
  };
  dashboard: {
    authSecret: string;
  };
  logging: {
    level: string;
  };
}
