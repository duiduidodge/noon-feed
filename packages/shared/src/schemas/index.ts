import { z } from 'zod';

// Controlled vocabulary for tags
export const TAG_VOCABULARY = [
  'BTC',
  'ETH',
  'DeFi',
  'NFT',
  'Memecoin',
  'ETF',
  'Macro',
  'Regulation',
  'L2',
  'AI',
  'Stablecoin',
  'Exchange',
  'Mining',
  'Hack',
  'Airdrop',
  'Altcoin',
  'Solana',
  'Gaming',
  'DAO',
  'Bridge',
] as const;

export const TagSchema = z.string().min(1).max(50);

export const SentimentSchema = z.enum(['bullish', 'bearish', 'neutral']);

export const MarketImpactSchema = z.enum(['high', 'medium', 'low']);

// LLM Output Schema - strict validation
export const EnrichmentOutputSchema = z.object({
  title_th: z
    .string()
    .min(1)
    .max(90)
    .describe('Thai headline, max 90 characters'),
  summary_th: z
    .string()
    .min(10)
    .max(1000)
    .describe('Thai summary, 3-5 sentences'),
  tags: z
    .array(TagSchema)
    .min(1)
    .max(5)
    .describe('Tags from controlled vocabulary + up to 2 custom'),
  sentiment: SentimentSchema,
  market_impact: MarketImpactSchema,
  cautions: z
    .array(z.string().min(5).max(200))
    .optional()
    .describe('What is uncertain or needs verification'),
  must_quote: z
    .array(z.string().min(3).max(100))
    .optional()
    .describe('Short phrases extracted from the article, max 15 words each'),
});

export type EnrichmentOutput = z.infer<typeof EnrichmentOutputSchema>;

// Minimal safe output when article is too short or extraction fails
export const MinimalEnrichmentOutputSchema = z.object({
  title_th: z.string().min(1).max(90),
  summary_th: z.string().min(1).max(500),
  tags: z.array(TagSchema).min(1).max(5),
  sentiment: SentimentSchema,
  market_impact: MarketImpactSchema,
  cautions: z.array(z.string()).default(['ข้อมูลจากบทความมีจำกัด กรุณาตรวจสอบแหล่งข้อมูลเพิ่มเติม']),
  must_quote: z.array(z.string()).optional(),
});

// API Request Schemas
export const ManualIngestRequestSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

export const CreateSourceRequestSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['RSS', 'API', 'MANUAL']),
  url: z.string().url('Invalid URL format'),
  enabled: z.boolean().default(true),
  category: z.string().optional(),
});

export const ArticleFilterSchema = z.object({
  sourceId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sentiment: SentimentSchema.optional(),
  marketImpact: MarketImpactSchema.optional(),
  status: z.enum(['PENDING', 'FETCHED', 'ENRICHED', 'FAILED', 'SKIPPED']).optional(),
  posted: z.boolean().optional(),
  search: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const PostToDiscordRequestSchema = z.object({
  channelId: z.string().optional(),
});

// Discord command schemas
export const NewsLatestCommandSchema = z.object({
  tag: z.string().optional(),
  limit: z.number().int().min(1).max(10).default(5),
});

// Config validation schemas
export const RSSFeedConfigSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  enabled: z.boolean().default(true),
  category: z.string().optional(),
});

export const ChannelRoutingSchema = z.object({
  channelId: z.string().min(1),
  channelName: z.string().min(1),
  tags: z.array(z.string()).min(1),
  isDefault: z.boolean().optional(),
});

export const AppConfigSchema = z.object({
  rssFeeds: z.array(RSSFeedConfigSchema),
  channelRouting: z.array(ChannelRoutingSchema),
  tagVocabulary: z.array(z.string()),
  scheduleIntervalMinutes: z.number().int().positive().default(5),
  llm: z.object({
    provider: z.enum(['openai', 'anthropic']),
    model: z.string(),
  }),
});

// Validation helpers
export function validateEnrichmentOutput(data: unknown): EnrichmentOutput {
  return EnrichmentOutputSchema.parse(data);
}

export function safeValidateEnrichmentOutput(
  data: unknown
): { success: true; data: EnrichmentOutput } | { success: false; error: z.ZodError } {
  const result = EnrichmentOutputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// JSON extraction helper
export function extractJsonFromResponse(text: string): unknown {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON object found in response');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    // Try to fix common JSON issues
    let fixedJson = jsonMatch[0]
      // Fix trailing commas
      .replace(/,(\s*[}\]])/g, '$1')
      // Fix unquoted keys
      .replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    try {
      return JSON.parse(fixedJson);
    } catch (e2) {
      throw new Error(`Failed to parse JSON: ${(e as Error).message}`);
    }
  }
}
