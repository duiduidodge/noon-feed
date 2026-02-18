import type { MarketImpact } from '@prisma/client';

const BREAKING_KEYWORDS = [
  'hack',
  'exploit',
  'drain',
  'breach',
  'liquidation',
  'bankruptcy',
  'sec',
  'lawsuit',
  'etf approval',
  'etf rejected',
  'halt',
  'suspended',
  'delisting',
  'insolvency',
  'depeg',
  'peg break',
  'shutdown',
  'emergency',
  'sanction',
  'cftc',
  'doj',
  'federal reserve',
  'interest rate',
  'tariff',
  'war',
];

export interface BreakingNewsEvaluationInput {
  title: string;
  extractedText?: string | null;
  marketImpact: MarketImpact;
  impactScore?: number | null;
}

export interface BreakingNewsEvaluationResult {
  shouldNotify: boolean;
  postingType: 'HIGH_IMPACT' | 'BREAKING';
  matchedKeywords: string[];
  reason: string;
}

export function evaluateBreakingNewsCandidate(
  input: BreakingNewsEvaluationInput,
  options?: {
    breakingEnabled?: boolean;
    allowMediumImpact?: boolean;
    minImpactScore?: number;
    minKeywordMatches?: number;
  }
): BreakingNewsEvaluationResult {
  const breakingEnabled = options?.breakingEnabled ?? false;
  const allowMediumImpact = options?.allowMediumImpact ?? true;
  const minImpactScore = options?.minImpactScore ?? 0.75;
  const minKeywordMatches = options?.minKeywordMatches ?? 1;

  const text = `${input.title} ${input.extractedText || ''}`.toLowerCase();
  const matchedKeywords = BREAKING_KEYWORDS.filter((keyword) => text.includes(keyword));

  if (input.marketImpact === 'HIGH') {
    return {
      shouldNotify: true,
      postingType: 'HIGH_IMPACT',
      matchedKeywords,
      reason: 'high market impact',
    };
  }

  if (!breakingEnabled) {
    return {
      shouldNotify: false,
      postingType: 'BREAKING',
      matchedKeywords,
      reason: 'breaking mode disabled',
    };
  }

  if (!allowMediumImpact || input.marketImpact !== 'MEDIUM') {
    return {
      shouldNotify: false,
      postingType: 'BREAKING',
      matchedKeywords,
      reason: 'not eligible impact tier',
    };
  }

  const score = Number(input.impactScore || 0);
  const meetsThreshold = score >= minImpactScore;
  const hasKeywords = matchedKeywords.length >= minKeywordMatches;

  if (meetsThreshold && hasKeywords) {
    return {
      shouldNotify: true,
      postingType: 'BREAKING',
      matchedKeywords,
      reason: `medium impact triggered by keywords (${matchedKeywords.join(', ')}) and score ${score.toFixed(2)}`,
    };
  }

  return {
    shouldNotify: false,
    postingType: 'BREAKING',
    matchedKeywords,
    reason: `did not meet thresholds: score=${score.toFixed(2)} keywords=${matchedKeywords.length}`,
  };
}
