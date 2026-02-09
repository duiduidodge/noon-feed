import { describe, it, expect } from 'vitest';
import { getChannelForTags, detectTagsFromText, TAG_VOCABULARY } from '../config/index.js';
import type { ChannelRouting } from '../types/index.js';

describe('getChannelForTags', () => {
  const routing: ChannelRouting[] = [
    { channelId: 'channel-market', channelName: 'market', tags: ['BTC', 'ETH'] },
    { channelId: 'channel-defi', channelName: 'defi', tags: ['DeFi', 'L2'] },
    { channelId: 'channel-policy', channelName: 'policy', tags: ['Regulation'] },
    { channelId: 'channel-default', channelName: 'general', tags: [], isDefault: true },
  ];

  it('should return market channel for BTC tag', () => {
    const channelId = getChannelForTags(['BTC', 'News'], routing);
    expect(channelId).toBe('channel-market');
  });

  it('should return defi channel for DeFi tag', () => {
    const channelId = getChannelForTags(['DeFi'], routing);
    expect(channelId).toBe('channel-defi');
  });

  it('should return first matching channel', () => {
    const channelId = getChannelForTags(['DeFi', 'BTC'], routing);
    expect(channelId).toBe('channel-market'); // BTC is checked first in routing order
  });

  it('should return default channel for unmatched tags', () => {
    const channelId = getChannelForTags(['Unknown', 'Random'], routing);
    expect(channelId).toBe('channel-default');
  });

  it('should return default channel for empty tags', () => {
    const channelId = getChannelForTags([], routing);
    expect(channelId).toBe('channel-default');
  });

  it('should match case-insensitively', () => {
    const channelId = getChannelForTags(['btc'], routing);
    expect(channelId).toBe('channel-market');
  });
});

describe('detectTagsFromText', () => {
  it('should detect BTC related keywords', () => {
    const text = 'Bitcoin price hits new all-time high';
    const tags = detectTagsFromText(text);
    expect(tags).toContain('BTC');
  });

  it('should detect ETH related keywords', () => {
    const text = 'Ethereum upgrade scheduled for next month';
    const tags = detectTagsFromText(text);
    expect(tags).toContain('ETH');
  });

  it('should detect DeFi keywords', () => {
    const text = 'New DeFi protocol offers 20% yield on staking';
    const tags = detectTagsFromText(text);
    expect(tags).toContain('DeFi');
  });

  it('should detect Regulation keywords', () => {
    const text = 'SEC announces new cryptocurrency regulation framework';
    const tags = detectTagsFromText(text);
    expect(tags).toContain('Regulation');
  });

  it('should detect multiple tags', () => {
    const text = 'Bitcoin ETF approved by SEC after long wait';
    const tags = detectTagsFromText(text);
    expect(tags).toContain('BTC');
    expect(tags).toContain('ETF');
    expect(tags).toContain('Regulation');
  });

  it('should return empty array for unrelated text', () => {
    const text = 'General news about weather and sports';
    const tags = detectTagsFromText(text);
    expect(tags).toEqual([]);
  });

  it('should not duplicate tags', () => {
    const text = 'Bitcoin and bitcoin and BITCOIN everywhere';
    const tags = detectTagsFromText(text);
    expect(tags.filter((t) => t === 'BTC').length).toBe(1);
  });
});

describe('TAG_VOCABULARY', () => {
  it('should contain expected tags', () => {
    expect(TAG_VOCABULARY).toContain('BTC');
    expect(TAG_VOCABULARY).toContain('ETH');
    expect(TAG_VOCABULARY).toContain('DeFi');
    expect(TAG_VOCABULARY).toContain('NFT');
    expect(TAG_VOCABULARY).toContain('Regulation');
    expect(TAG_VOCABULARY).toContain('Macro');
  });

  it('should be non-empty', () => {
    expect(TAG_VOCABULARY.length).toBeGreaterThan(0);
  });
});
