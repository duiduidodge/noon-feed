import type { LLMProviderInterface, EnrichmentOutput } from '@crypto-news/shared';
import {
  createLogger,
  TAG_VOCABULARY,
  detectTagsFromText,
  EnrichmentOutputSchema,
  extractJsonFromResponse,
  truncate,
} from '@crypto-news/shared';

const logger = createLogger('worker:enrichment');

const ENRICHMENT_PROMPT = `Analyze the crypto article and return JSON only.
Rules: Thai only (tags in English), use ONLY the article, no speculation, add cautions if uncertain.
Tags: choose 1-5 from ${TAG_VOCABULARY.join(', ')} (you may add 1-2 custom).

ARTICLE:
{ARTICLE_TEXT}

TITLE: {ARTICLE_TITLE}
SOURCE: {SOURCE_NAME}
PUBLISHED: {PUBLISHED_AT}

JSON schema:
{
  "title_th": "Thai headline, <=90 chars",
  "summary_th": "Thai summary, 3-5 sentences",
  "tags": ["..."],
  "sentiment": "bullish|bearish|neutral",
  "market_impact": "high|medium|low",
  "cautions": ["Thai, if needed"],
  "must_quote": ["<=15 words, if needed"]
}`;

const FIX_JSON_PROMPT = `Fix this invalid JSON and return ONLY corrected JSON:

{INVALID_JSON}

Expected keys: title_th, summary_th, tags(1-5), sentiment, market_impact, cautions?, must_quote?`;

export interface EnrichmentInput {
  articleText: string;
  articleTitle: string;
  sourceName: string;
  publishedAt?: Date;
  url: string;
}

export class EnrichmentService {
  private llmProvider: LLMProviderInterface;

  constructor(llmProvider: LLMProviderInterface) {
    this.llmProvider = llmProvider;
  }

  async enrich(input: EnrichmentInput): Promise<EnrichmentOutput> {
    const { articleText, articleTitle, sourceName, publishedAt, url } = input;

    // Check if article text is too short
    if (articleText.length < 100) {
      logger.warn({ url, textLength: articleText.length }, 'Article text too short');
      return this.createMinimalOutput(articleTitle, sourceName, articleText);
    }

    // Truncate very long articles
    const truncatedText = truncate(articleText, 4000);

    // Build the prompt
    const prompt = ENRICHMENT_PROMPT.replace('{ARTICLE_TEXT}', truncatedText)
      .replace('{ARTICLE_TITLE}', articleTitle)
      .replace('{SOURCE_NAME}', sourceName)
      .replace('{PUBLISHED_AT}', publishedAt?.toISOString() || 'Unknown');

    logger.info({ url, textLength: truncatedText.length }, 'Sending article for enrichment');

    // Get LLM response
    let response = await this.llmProvider.complete(prompt);

    // Try to parse and validate
    let parsed: unknown;
    try {
      parsed = extractJsonFromResponse(response);
    } catch (error) {
      logger.warn({ error: (error as Error).message }, 'Failed to extract JSON, attempting fix');
      try {
        parsed = await this.attemptJsonFix(response);
      } catch (fixError) {
        logger.error({ error: (fixError as Error).message }, 'JSON fix also failed, using minimal output');
        return this.createMinimalOutput(articleTitle, sourceName, articleText);
      }
    }

    // Validate with schema
    const validation = EnrichmentOutputSchema.safeParse(parsed);

    if (!validation.success) {
      // Don't make another LLM call — just fall back to minimal output.
      // The original LLM call already failed to produce valid schema output,
      // sending the same data again rarely fixes structural issues and wastes tokens.
      logger.warn({ errors: validation.error.errors }, 'Schema validation failed, using minimal output');
      return this.createMinimalOutput(articleTitle, sourceName, articleText);
    }

    logger.info({ url }, 'Article enriched successfully');
    return validation.data;
  }

  private async attemptJsonFix(invalidJson: string): Promise<unknown> {
    const fixPrompt = FIX_JSON_PROMPT.replace('{INVALID_JSON}', invalidJson);
    const fixedResponse = await this.llmProvider.complete(fixPrompt);
    return extractJsonFromResponse(fixedResponse);
  }

  private createMinimalOutput(title: string, source: string, text: string): EnrichmentOutput {
    // Detect tags from available text
    const detectedTags = detectTagsFromText(title + ' ' + text);
    const tags = detectedTags.length > 0 ? detectedTags.slice(0, 3) : ['Altcoin'];

    return {
      title_th: `${title.substring(0, 80)}...`,
      summary_th: 'เนื้อหาบทความมีจำกัด ไม่สามารถสรุปได้อย่างครบถ้วน กรุณาอ่านบทความต้นฉบับสำหรับข้อมูลเพิ่มเติม',
      tags,
      sentiment: 'neutral',
      market_impact: 'low',
      cautions: ['เนื้อหาบทความมีจำกัด ข้อมูลอาจไม่ครบถ้วน'],
    };
  }
}
