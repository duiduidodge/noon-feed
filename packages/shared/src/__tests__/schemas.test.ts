import { describe, it, expect } from 'vitest';
import {
  EnrichmentOutputSchema,
  validateEnrichmentOutput,
  safeValidateEnrichmentOutput,
  extractJsonFromResponse,
} from '../schemas/index.js';

describe('EnrichmentOutputSchema', () => {
  const validOutput = {
    title_th: 'หัวข้อภาษาไทย',
    summary_th: 'นี่คือสรุปข่าวภาษาไทยที่มีความยาวพอสมควร เพื่อให้ผ่านการตรวจสอบ',
    tags: ['BTC', 'ETF'],
    sentiment: 'bullish' as const,
    market_impact: 'high' as const,
  };

  it('should validate correct output', () => {
    const result = EnrichmentOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it('should reject title over 90 characters', () => {
    const invalid = {
      ...validOutput,
      title_th: 'ก'.repeat(91),
    };
    const result = EnrichmentOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject invalid sentiment', () => {
    const invalid = {
      ...validOutput,
      sentiment: 'positive',
    };
    const result = EnrichmentOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject invalid market_impact', () => {
    const invalid = {
      ...validOutput,
      market_impact: 'critical',
    };
    const result = EnrichmentOutputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should allow optional cautions', () => {
    const withCautions = {
      ...validOutput,
      cautions: ['ข้อควรระวัง 1', 'ข้อควรระวัง 2'],
    };
    const result = EnrichmentOutputSchema.safeParse(withCautions);
    expect(result.success).toBe(true);
  });

  it('should allow optional must_quote', () => {
    const withQuotes = {
      ...validOutput,
      must_quote: ['Important quote here'],
    };
    const result = EnrichmentOutputSchema.safeParse(withQuotes);
    expect(result.success).toBe(true);
  });
});

describe('validateEnrichmentOutput', () => {
  it('should return data for valid input', () => {
    const validOutput = {
      title_th: 'หัวข้อภาษาไทย',
      summary_th: 'สรุปข่าวภาษาไทยที่มีความยาวพอสมควร',
      tags: ['BTC'],
      sentiment: 'neutral' as const,
      market_impact: 'medium' as const,
    };
    expect(() => validateEnrichmentOutput(validOutput)).not.toThrow();
  });

  it('should throw for invalid input', () => {
    expect(() => validateEnrichmentOutput({ invalid: true })).toThrow();
  });
});

describe('safeValidateEnrichmentOutput', () => {
  it('should return success true for valid input', () => {
    const validOutput = {
      title_th: 'หัวข้อภาษาไทย',
      summary_th: 'สรุปข่าวภาษาไทยที่มีความยาวพอสมควรสำหรับการทดสอบ',
      tags: ['ETH'],
      sentiment: 'bearish' as const,
      market_impact: 'low' as const,
    };
    const result = safeValidateEnrichmentOutput(validOutput);
    expect(result.success).toBe(true);
  });

  it('should return success false for invalid input', () => {
    const result = safeValidateEnrichmentOutput({ invalid: true });
    expect(result.success).toBe(false);
  });
});

describe('extractJsonFromResponse', () => {
  it('should extract JSON from clean response', () => {
    const response = '{"key": "value"}';
    const result = extractJsonFromResponse(response);
    expect(result).toEqual({ key: 'value' });
  });

  it('should extract JSON with surrounding text', () => {
    const response = 'Here is the JSON: {"key": "value"} That was the JSON.';
    const result = extractJsonFromResponse(response);
    expect(result).toEqual({ key: 'value' });
  });

  it('should throw for response without JSON', () => {
    const response = 'No JSON here';
    expect(() => extractJsonFromResponse(response)).toThrow('No JSON object found');
  });

  it('should handle JSON with trailing commas', () => {
    const response = '{"key": "value",}';
    const result = extractJsonFromResponse(response);
    expect(result).toEqual({ key: 'value' });
  });
});
