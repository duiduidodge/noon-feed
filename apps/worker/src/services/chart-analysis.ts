/**
 * Vision LLM chart analysis — sends a rendered chart image to a vision model
 * and returns a concise technical analysis.
 */

import type { LLMProviderInterface } from '@crypto-news/shared';
import { createLogger } from '@crypto-news/shared';

const logger = createLogger('worker:chart-analysis');

export async function analyzeChart(
  llmProvider: LLMProviderInterface,
  chartImageBase64: string,
  asset: string,
  direction: string,
  regime: string,
  adx: number,
  rsi1h: number,
  rsi1d: number,
): Promise<string | null> {
  if (!llmProvider.completeWithImage) {
    logger.warn('LLM provider does not support vision; skipping chart analysis');
    return null;
  }

  const prompt = `You are a senior crypto technical analyst at a hedge fund. Analyze this 4H candlestick chart for ${asset}/USDT.

The quantitative indicators suggest a ${direction} setup in a ${regime} market (ADX ${adx.toFixed(0)}, RSI1H ${rsi1h.toFixed(0)}, RSI1D ${rsi1d.toFixed(0)}).

The chart shows: candlesticks (green=bull, red=bear), EMA20 (orange), EMA50 (blue), pivot levels (S1/PP/R1 dashed lines), and a direction arrow.

Smart Money Concepts overlays:
- Green/red shaded zones = Fair Value Gaps (FVG) — imbalance zones price may revisit
- Cyan/purple shaded zones = Order Blocks (OB) — institutional demand/supply zones
- Cyan dashed lines labeled "BOS" = Break of Structure (trend continuation)
- Yellow dashed lines labeled "CHoCH" = Change of Character (potential reversal)
- White diamonds = Swing Highs/Lows (structural pivot points)

Identify:
1. Key price action patterns and how they relate to the SMC overlays (is price respecting OBs? filling FVGs? breaking structure?)
2. How price is interacting with the EMA lines (bouncing, crossing, riding)
3. Whether the chart CONFIRMS or CONTRADICTS the ${direction} bias — use both classical TA and SMC evidence
4. Any warning signs (unfilled FVGs above/below, CHoCH signals, price in a supply/demand zone)

Be concise — 3-4 sentences max. Focus on what a trader needs to know RIGHT NOW.`;

  try {
    const analysis = await llmProvider.completeWithImage(prompt, chartImageBase64, {
      temperature: 0.2,
      maxTokens: 300,
    });
    logger.info({ asset }, 'Chart analysis completed');
    return analysis.trim();
  } catch (error) {
    logger.error({ error: (error as Error).message, asset }, 'Chart analysis failed');
    return null;
  }
}
