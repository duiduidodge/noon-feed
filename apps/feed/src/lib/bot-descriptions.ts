export interface BotDescription {
  tagline: string;
  strategy: string;
  tags: string[];
}

const BOT_DESCRIPTIONS: Record<string, BotDescription> = {
  'noon-trader': {
    tagline: 'Perpetuals momentum & mean-reversion on Hyperliquid.',
    strategy:
      'Noon Trader runs a dual-mode execution engine on Hyperliquid perpetuals. In momentum mode it follows breakouts confirmed by volume and funding-rate bias. In mean-reversion mode it fades extended moves on range-bound assets. Risk is capped per position with a max drawdown circuit breaker that halts the strategy until manually cleared.',
    tags: ['Perpetuals', 'Momentum', 'Mean-Reversion', 'Hyperliquid'],
  },
  'trend-switch-bot': {
    tagline: 'Adaptive trend-following paper trader on Hyperliquid.',
    strategy:
      'Trend Switch Bot scans higher-timeframe trend structure, confirms directional bias with moving-average alignment and volatility filters, then rotates into the strongest valid trend setup. In paper mode it starts from a fixed $1,000 book, respects capped concurrent exposure, and stands down when trend quality or risk conditions deteriorate.',
    tags: ['Perpetuals', 'Trend-Following', 'Paper Trading', 'Hyperliquid'],
  },
};

export function getBotDescription(slug: string): BotDescription | null {
  return BOT_DESCRIPTIONS[slug] ?? null;
}
