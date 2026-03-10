/**
 * LLM-powered trade thesis generator.
 * Produces 3-5 bullet points explaining the reasoning behind each A-tier signal.
 */

import type { LLMProviderInterface } from '@crypto-news/shared';
import { createLogger } from '@crypto-news/shared';
import type { OpportunityResult } from './opportunity-scanner.js';

const logger = createLogger('worker:thesis');

interface BtcContext {
  price: number;
  trend: string;
  change1h: number;
  change24h: number;
}

export async function generateThesis(
  llmProvider: LLMProviderInterface,
  signal: OpportunityResult,
  chartAnalysis: string | null,
  btcContext: BtcContext,
): Promise<string[]> {
  const { technicals: tech, pillarScores: p, funding, regime, exitLevels: el } = signal;

  const prompt = `You are a senior crypto hedge fund analyst. Generate 3-5 concise bullet points explaining the thesis for this trade setup. Each bullet should be 1 sentence max. Write in a direct, confident tone — no hedging language.

## Signal Data
Asset: ${signal.asset}
Direction: ${signal.direction} at ${signal.leverage}x leverage
Score: ${signal.finalScore.toFixed(0)} (Derivatives: ${p.derivatives.toFixed(0)}, Structure: ${p.marketStructure.toFixed(0)}, Technicals: ${p.technicals.toFixed(0)})
Conviction: ${signal.convictionTier}-tier ${signal.swingGrade ? '(Swing grade — daily confirmed)' : ''}

## Market Context
Regime: ${regime} (ADX ${tech.adx4h.toFixed(0)})
BTC: $${btcContext.price.toLocaleString()} ${btcContext.trend} (1H: ${btcContext.change1h >= 0 ? '+' : ''}${btcContext.change1h.toFixed(2)}%)

## Technicals
Trends: 1H ${tech.trend1h}, 4H ${tech.trend4h}, Daily ${tech.trendDaily}
RSI: 1H ${tech.rsi1h.toFixed(0)}, Daily ${tech.rsi1d.toFixed(0)}
Volume Ratio: ${tech.volRatio1h.toFixed(1)}x ${signal.volumeSpike ? '(SPIKE)' : ''}
EMA Bounce: ${tech.emaBounce.confluence}/${tech.emaBounce.required} timeframes confirmed
Patterns: ${tech.patterns1h.length > 0 ? tech.patterns1h.join(', ') : 'none'}
ATR: ${tech.atrPct.toFixed(2)}%

## Derivatives
Funding: ${funding.rate}% (${funding.annualized.toFixed(0)}% ann.) — ${funding.favorable ? 'favorable' : 'unfavorable'}

## Risk Management
SL: $${el.initialSL.toLocaleString()} | TP1: $${el.tp1.toLocaleString()} | TP2: $${el.tp2.toLocaleString()}
Risk: ${el.riskPct.toFixed(1)}% | Max Hold: ${el.maxHoldHours}h
Risk Flags: ${signal.risks.length > 0 ? signal.risks.join(', ') : 'none'}

${chartAnalysis ? `## Chart Analysis (from vision model)\n${chartAnalysis}` : ''}

Focus on: (1) Why now — what's the edge and timing? (2) What confirms the direction? (3) Key risk to monitor.
Return valid JSON: { "bullets": ["...", "...", "..."] }`;

  try {
    const response = await llmProvider.complete(prompt, {
      temperature: 0.3,
      maxTokens: 500,
    });

    const parsed = JSON.parse(response);
    if (Array.isArray(parsed.bullets) && parsed.bullets.length > 0) {
      logger.info({ asset: signal.asset, count: parsed.bullets.length }, 'Thesis generated');
      return parsed.bullets.slice(0, 5);
    }

    logger.warn({ asset: signal.asset, response }, 'Unexpected thesis format');
    return [];
  } catch (error) {
    logger.error({ error: (error as Error).message, asset: signal.asset }, 'Thesis generation failed');
    return [];
  }
}
