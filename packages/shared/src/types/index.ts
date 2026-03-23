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
  completeWithImage?(prompt: string, imageBase64: string, options?: LLMOptions): Promise<string>;
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
    cleanupIntervalHours: number;
    articleRetentionDays: number;
    heartbeatRetentionDays: number;
    emergingRetentionDays: number;
    whaleRetentionDays: number;
    marketSummaryRetentionDays: number;
    jobAuditRetentionDays: number;
    autoPostToDiscord: boolean;
    skipEnrichment: boolean;
    enableSwingTradeNotifications: boolean;
    enableHighImpactPosting: boolean;
    enableApiNews: boolean;
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

export interface NoonHubBotRegistration {
  slug: string;
  name: string;
  environment?: string;
  category?: string;
  strategyFamily?: string;
  venue?: string;
  repoUrl?: string;
  dashboardUrl?: string;
  status?: string;
  isEnabled?: boolean;
  metadata?: Record<string, unknown>;
  lastHeartbeatAt?: string;
}

export interface NoonHubHeartbeatPayload {
  botSlug: string;
  name: string;
  status?: string;
  message?: string;
  version?: string;
  latencyMs?: number;
  uptimeSec?: number;
  observedAt?: string;
  environment?: string;
  category?: string;
  strategyFamily?: string;
  venue?: string;
  repoUrl?: string;
  dashboardUrl?: string;
  isEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface NoonHubMetricsPayload {
  botSlug: string;
  name: string;
  status?: string;
  observedAt?: string;
  environment?: string;
  category?: string;
  strategyFamily?: string;
  venue?: string;
  equityUsd?: number;
  cashUsd?: number;
  realizedPnlUsd?: number;
  unrealizedPnlUsd?: number;
  dailyPnlUsd?: number;
  drawdownPct?: number;
  winRatePct?: number;
  openPositions?: number;
  metadata?: Record<string, unknown>;
}

export interface NoonHubPosition {
  symbol: string;
  side: string;
  status?: string;
  quantity?: number;
  entryPrice?: number;
  markPrice?: number;
  pnlUsd?: number;
  pnlPct?: number;
  openedAt?: string;
  closedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface NoonHubPositionsPayload {
  botSlug: string;
  name: string;
  status?: string;
  snapshotTime?: string;
  environment?: string;
  category?: string;
  strategyFamily?: string;
  venue?: string;
  positions: NoonHubPosition[];
}

export interface NoonHubEventPayload {
  botSlug: string;
  name: string;
  status?: string;
  environment?: string;
  category?: string;
  strategyFamily?: string;
  venue?: string;
  eventType: string;
  severity?: string;
  title: string;
  body?: string;
  symbol?: string;
  eventAt?: string;
  payload?: Record<string, unknown>;
}

export interface NoonHubClientOptions {
  baseUrl: string;
  ingestKey?: string;
  defaultBot?: Omit<NoonHubBotRegistration, 'lastHeartbeatAt'>;
  fetchImpl?: typeof fetch;
}
