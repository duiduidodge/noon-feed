import { createLogger } from '@crypto-news/shared';
import type { LLMProviderInterface } from '@crypto-news/shared';

const logger = createLogger('worker:impact-filter');

export interface ImpactEvaluation {
  score: number;           // 0.00-1.00
  shouldEnrich: boolean;   // Whether article passes threshold
  reasoning?: string;      // Optional reasoning from LLM
}

/**
 * Impact Filter Service
 * Uses a cheap LLM model to pre-filter articles before enrichment
 * Helps reduce LLM costs by only enriching high-potential articles
 */
export class ImpactFilter {
  private llmProvider: LLMProviderInterface;
  private readonly threshold: number;

  constructor(llmProvider: LLMProviderInterface, threshold: number = 0.7) {
    this.llmProvider = llmProvider;
    this.threshold = threshold;
  }

  /**
   * Evaluate an article's potential market impact
   * @param article - Article metadata
   * @returns Impact evaluation with score and enrichment decision
   */
  async evaluateImpact(article: {
    titleOriginal: string;
    extractedText: string;
    sourceName: string;
  }): Promise<ImpactEvaluation> {
    try {
      // Create preview (first 300 chars of extracted text)
      const preview = article.extractedText.substring(0, 300).trim();

      // Prompt for quick impact assessment
      const prompt = `You are a crypto market analyst. Rate the potential market impact of this news article on a scale of 0.0 to 1.0.

Consider:
- Price-moving events (regulations, major partnerships, hacks, launches)
- Market sentiment impact (fear, greed, uncertainty)
- Trading volume implications
- Relevance to major cryptocurrencies (BTC, ETH, SOL, etc.)

Return ONLY a JSON object with this exact format:
{
  "score": 0.0-1.0,
  "reasoning": "brief explanation"
}

Source: ${article.sourceName}
Title: ${article.titleOriginal}
Preview: ${preview}`;

      logger.debug({ title: article.titleOriginal }, 'Evaluating article impact');

      // Quick LLM call with minimal tokens
      const response = await this.llmProvider.complete(prompt, {
        maxTokens: 100,
        temperature: 0.3, // Lower temperature for more consistent scoring
      });

      // Parse JSON response
      const cleaned = response.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleaned);

      const score = Math.max(0, Math.min(1, parseFloat(parsed.score || '0')));
      const shouldEnrich = score >= this.threshold;

      logger.info({
        title: article.titleOriginal.substring(0, 50),
        score: score.toFixed(2),
        threshold: this.threshold,
        shouldEnrich,
      }, 'Impact evaluation completed');

      return {
        score: Math.round(score * 100) / 100, // Round to 2 decimals
        shouldEnrich,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      logger.error({
        error: (error as Error).message,
        title: article.titleOriginal,
      }, 'Impact evaluation failed, defaulting to low score');

      // On error, default to low score (don't enrich)
      return {
        score: 0.0,
        shouldEnrich: false,
        reasoning: 'Error during evaluation',
      };
    }
  }

  /**
   * Batch evaluate multiple articles
   * @param articles - Array of articles to evaluate
   * @returns Array of evaluations matching input order
   */
  async evaluateMultiple(
    articles: Array<{
      titleOriginal: string;
      extractedText: string;
      sourceName: string;
    }>
  ): Promise<ImpactEvaluation[]> {
    // Evaluate in parallel with concurrency limit
    const concurrency = 3;
    const results: ImpactEvaluation[] = [];

    for (let i = 0; i < articles.length; i += concurrency) {
      const batch = articles.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((article) => this.evaluateImpact(article))
      );
      results.push(...batchResults);
    }

    return results;
  }
}
