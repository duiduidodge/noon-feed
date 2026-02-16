import { createLogger } from '@crypto-news/shared';
import type { FinnhubSentiment } from './finnhub.js';
import type { FMPSentiment } from './fmp.js';

const logger = createLogger('worker:sentiment:aggregator');

export type Sentiment = 'bullish' | 'bearish' | 'neutral';

export interface AggregatedSentiment {
  sentiment: Sentiment;
  confidence: number;  // 0.0-1.0
  sources: {
    llm: number;       // -1 to 1
    finnhub?: number;  // -1 to 1
    fmp?: number;      // -1 to 1
  };
}

/**
 * Convert LLM sentiment enum to numeric score
 */
function llmSentimentToScore(sentiment: string): number {
  const normalized = sentiment.toLowerCase();
  if (normalized === 'bullish') return 1;
  if (normalized === 'bearish') return -1;
  return 0; // neutral
}

/**
 * Convert numeric score to sentiment label
 */
function scoreToSentiment(score: number): Sentiment {
  if (score > 0.3) return 'bullish';
  if (score < -0.3) return 'bearish';
  return 'neutral';
}

/**
 * Aggregate sentiment from multiple sources
 *
 * @param llmSentiment - Sentiment from LLM enrichment ('bullish' | 'bearish' | 'neutral')
 * @param finnhub - Optional Finnhub sentiment data
 * @param fmp - Optional FMP sentiment data
 * @returns Aggregated sentiment with confidence score
 *
 * Confidence calculation:
 * - Based on variance among sources (low variance = high agreement = high confidence)
 * - Minimum confidence: 0.5 (single source)
 * - Maximum confidence: 1.0 (all sources agree perfectly)
 */
export function aggregateSentiment(
  llmSentiment: string,
  finnhub?: FinnhubSentiment | null,
  fmp?: FMPSentiment | null
): AggregatedSentiment {
  // Convert LLM sentiment to numeric score
  const llmScore = llmSentimentToScore(llmSentiment);

  // Collect all available scores
  const scores: number[] = [llmScore];
  const sources: AggregatedSentiment['sources'] = { llm: llmScore };

  if (finnhub) {
    scores.push(finnhub.score);
    sources.finnhub = finnhub.score;
  }

  if (fmp) {
    scores.push(fmp.sentiment);
    sources.fmp = fmp.sentiment;
  }

  // Calculate average score
  const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  // Calculate variance (measure of disagreement)
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;

  // Convert variance to confidence (0.0-1.0)
  // Low variance = high confidence
  // Max variance is 4 (when one is -1 and another is 1, with avg 0)
  // confidence = 1 - (variance / 4)
  // Add base confidence based on number of sources
  const baseConfidence = 0.5 + (scores.length - 1) * 0.1; // 0.5 for 1 source, 0.6 for 2, 0.7 for 3
  const varianceConfidence = Math.max(0, 1 - variance / 2); // Normalize variance contribution
  const confidence = Math.min(1.0, Math.max(0.5, baseConfidence * varianceConfidence));

  // Determine final sentiment from average score
  const finalSentiment = scoreToSentiment(avgScore);

  logger.debug({
    llmSentiment,
    avgScore,
    variance,
    confidence: confidence.toFixed(2),
    finalSentiment,
    sourceCount: scores.length,
  }, 'Aggregated sentiment');

  return {
    sentiment: finalSentiment,
    confidence: Math.round(confidence * 100) / 100, // Round to 2 decimals
    sources,
  };
}
