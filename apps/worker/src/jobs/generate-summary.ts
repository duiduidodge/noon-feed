import { PrismaClient } from '@prisma/client';
import { createLogger, escapeMarkdown } from '@crypto-news/shared';
import type { LLMProviderInterface } from '@crypto-news/shared';

const logger = createLogger('worker:job:generate-summary');

export interface GenerateSummaryJobData {
  scheduleType: 'morning' | 'evening';
  webhookUrl?: string;
}

interface HeadlineItem {
  title: string;
  url: string;
  source: string;
}

interface PriceData {
  btc: { price: number; change24h: number };
  eth: { price: number; change24h: number };
  sol: { price: number; change24h: number };
  hype: { price: number; change24h: number };
  totalMarketCap: number;
  marketCapChange24h: number;
  fearGreedIndex: number;
  fearGreedLabel: string;
}

// Fetch prices from CoinGecko
async function fetchPrices(): Promise<PriceData> {
  // Fetch coin prices
  const priceRes = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,hyperliquid&vs_currencies=usd&include_24hr_change=true',
    { headers: { Accept: 'application/json' } }
  );

  let coins: any = {};
  if (priceRes.ok) {
    coins = await priceRes.json();
  }

  // Fetch global market data
  let globalData: any = {};
  try {
    const globalRes = await fetch('https://api.coingecko.com/api/v3/global', {
      headers: { Accept: 'application/json' },
    });
    if (globalRes.ok) {
      const json = await globalRes.json();
      globalData = json.data || {};
    }
  } catch {
    // Non-critical
  }

  // Fetch Fear & Greed
  let fearGreed = { value: 0, label: 'N/A' };
  try {
    const fgRes = await fetch('https://api.alternative.me/fng/?limit=1', {
      headers: { Accept: 'application/json' },
    });
    if (fgRes.ok) {
      const fgJson = await fgRes.json();
      const entry = fgJson.data?.[0];
      fearGreed = {
        value: parseInt(entry?.value || '0'),
        label: entry?.value_classification || 'N/A',
      };
    }
  } catch {
    // Non-critical
  }

  return {
    btc: {
      price: coins.bitcoin?.usd || 0,
      change24h: coins.bitcoin?.usd_24h_change || 0,
    },
    eth: {
      price: coins.ethereum?.usd || 0,
      change24h: coins.ethereum?.usd_24h_change || 0,
    },
    sol: {
      price: coins.solana?.usd || 0,
      change24h: coins.solana?.usd_24h_change || 0,
    },
    hype: {
      price: coins.hyperliquid?.usd || 0,
      change24h: coins.hyperliquid?.usd_24h_change || 0,
    },
    totalMarketCap: globalData.total_market_cap?.usd || 0,
    marketCapChange24h: globalData.market_cap_change_percentage_24h_usd || 0,
    fearGreedIndex: fearGreed.value,
    fearGreedLabel: fearGreed.label,
  };
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  return `$${(value / 1e6).toFixed(0)}M`;
}

function fearGreedEmoji(value: number): string {
  if (value <= 25) return '🔴';
  if (value <= 45) return '🟠';
  if (value <= 55) return '🟡';
  return '🟢';
}

// Build the LLM prompt for generating a Thai summary
function buildSummaryPrompt(
  headlines: HeadlineItem[],
  prices: PriceData,
  scheduleType: 'morning' | 'evening'
): string {
  const period = scheduleType === 'morning' ? 'เช้า (รอบ 7:00 น.)' : 'เย็น (รอบ 19:00 น.)';
  const now = new Date();
  const bangkokDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const dateStr = bangkokDate.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const headlinesList = headlines
    .slice(0, 30) // Cap at 30 headlines for prompt size
    .map((h, i) => `${i + 1}. "${h.title}" — ${h.source}`)
    .join('\n');

  return `You are a senior Thai crypto analyst providing a bi-daily market outlook for a Discord community of Thai crypto traders and investors.

## Context
This is the ${period} summary for ${dateStr}.
Your analysis will be displayed ABOVE a price table and a headline list — so do NOT repeat price numbers or list news headlines. They are already shown separately.

**IMPORTANT**: The headlines below are PRE-FILTERED to show only HIGH and MEDIUM impact news. These include major market movers (HIGH) and significant updates (MEDIUM). Use HIGH impact stories as the core of your narrative, and use MEDIUM impact stories to support your analysis of broader trends.

## Market Data (reference only — do NOT quote these numbers)
- BTC: ${formatPrice(prices.btc.price)} (${formatChange(prices.btc.change24h)})
- ETH: ${formatPrice(prices.eth.price)} (${formatChange(prices.eth.change24h)})
- SOL: ${formatPrice(prices.sol.price)} (${formatChange(prices.sol.change24h)})
- HYPE: ${formatPrice(prices.hype.price)} (${formatChange(prices.hype.change24h)})
- Total Market Cap: ${formatMarketCap(prices.totalMarketCap)} (${formatChange(prices.marketCapChange24h)})
- Fear & Greed Index: ${prices.fearGreedIndex} (${prices.fearGreedLabel})

## HIGH & MEDIUM IMPACT News Headlines (${headlines.length} major stories since last summary):
${headlinesList || '(No major headlines in this period)'}

## Writing Rules
Write a JSON response with:

1. "market_context": A 2-3 paragraph analysis in Thai.
   DO:
   - Analyze the overall market sentiment, structure, and macro narrative
   - ALL headlines shown are already pre-filtered as HIGH/MEDIUM impact. Weave these major stories into your analysis naturally as context — but do not recap them individually
   - Be opinionated about what the market signals mean
   - Each paragraph should make a distinct point — no repetition

   LANGUAGE:
   - Write predominantly in Thai. The base language is Thai.
   - Use English ONLY for crypto/finance jargon AND specific names (e.g. sentiment, rally, sideway, flash crash, liquidity, institutional flow, ETF, short squeeze, support, resistance, dominance, altcoin, DeFi, whale)
   - KEEP all specific names (people, projects, companies, tokens) in ENGLISH. Do NOT transliterate them.
     - Example: "Binance" -> "Binance" (NOT "ไบแนนซ์")
     - Example: "Vitalik Buterin" -> "Vitalik Buterin"
     - Example: "Bitcoin" -> "Bitcoin" (NOT "บิทคอยน์")
   - Normal vocabulary MUST be in Thai, not English. For example: write "สะท้อน" not "reflect", "ครอง" not "dominate", "สังเกต" not "observe", "อ่อนไหว" not "sensitive", "ส่งสัญญาณ" not "signal", "ปัจจัย" not "factor", "แนวโน้ม" not "trend" (unless used as a technical term)
   - Aim for roughly 80% Thai, 20% English crypto terms

   DO NOT:
   - Quote exact prices or percentages from the data above
   - List or summarize individual headlines
   - Give directional trading advice, price targets, or recommendations (no "buy", "sell", "entry", "stop-loss", "position sizing")
   - Repeat the same observation in different words across paragraphs

   Tone: Sharp, analytical, like a Bloomberg market commentary written for Thai audience. Observe and interpret — do not advise.

2. "section_title": A punchy Thai title capturing today's market mood (max 50 chars, no emoji)

Respond ONLY with valid JSON. No markdown code blocks.`;
}

// Format and send Discord webhook
// Discord limits: embed description 4096 chars, field value 1024 chars, total 6000 chars
async function postSummaryToDiscord(
  webhookUrl: string,
  summaryText: string,
  sectionTitle: string,
  headlines: HeadlineItem[],
  prices: PriceData,
  scheduleType: 'morning' | 'evening'
): Promise<void> {
  const timeEmoji = scheduleType === 'morning' ? '🌅' : '🌆';

  // Truncate summary if needed
  const maxSummaryLen = 1500;
  const description = summaryText.length > maxSummaryLen
    ? summaryText.substring(0, maxSummaryLen).replace(/\s+\S*$/, '') + '...'
    : summaryText;

  // Price field — vertical layout with green/red indicators
  const coinLines = [
    { name: 'BTC', price: prices.btc.price, change: prices.btc.change24h },
    { name: 'ETH', price: prices.eth.price, change: prices.eth.change24h },
    { name: 'SOL', price: prices.sol.price, change: prices.sol.change24h },
    { name: 'HYPE', price: prices.hype.price, change: prices.hype.change24h },
  ];

  const priceLines = coinLines
    .map((c) => {
      const icon = c.change >= 0 ? '🟢' : '🔴';
      const pad = c.name.length === 3 ? ' ' : '';
      return `${icon} **${c.name}**${pad} \`${formatPrice(c.price)}\` (${formatChange(c.change)})`;
    })
    .join('\n');

  const fgEmoji = fearGreedEmoji(prices.fearGreedIndex);
  const mcapIcon = prices.marketCapChange24h >= 0 ? '📈' : '📉';

  const priceField = [
    priceLines,
    '',
    `${mcapIcon} MCap: **${formatMarketCap(prices.totalMarketCap)}** (${formatChange(prices.marketCapChange24h)})`,
    `${fgEmoji} Fear & Greed: **${prices.fearGreedIndex}** — ${prices.fearGreedLabel}`,
  ].join('\n');

  // Headline chunks — keep under 1024 chars per field
  const headlineItems = headlines.slice(0, 15);
  const headlineChunks: string[] = [];
  let currentChunk = '';

  for (const h of headlineItems) {
    const line = `• [${h.title.substring(0, 80)}](${h.url}) — *${h.source}*\n`;
    if (currentChunk.length + line.length > 1000) {
      headlineChunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk += line;
    }
  }
  if (currentChunk.trim()) {
    headlineChunks.push(currentChunk.trim());
  }

  // Build fields
  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    {
      name: '💰 ราคาตลาด',
      value: priceField,
      inline: false,
    },
  ];

  headlineChunks.forEach((chunk, i) => {
    fields.push({
      name: i === 0 ? `📰 ข่าวเด่น ${headlines.length} ข่าว` : '\u200b',
      value: chunk,
      inline: false,
    });
  });

  // Build the embed
  const embed = {
    title: `${timeEmoji} ${sectionTitle}`,
    description,
    color: 0x00e5cc,
    fields,
    footer: {
      text: `Crypto News Bot • สรุปทุก 7:00 & 19:00 น.`,
    },
    timestamp: new Date().toISOString(),
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord webhook error: ${response.status} - ${error}`);
  }
}

// Main job processor
export async function processGenerateSummaryJob(
  data: GenerateSummaryJobData,
  prisma: PrismaClient,
  llmProvider: LLMProviderInterface
): Promise<{ success: boolean; summaryId: string }> {
  const { scheduleType, webhookUrl } = data;

  logger.info({ scheduleType }, 'Generating bi-daily market summary');

  // 1. Get articles since the last summary (fallback: 14 hours if no previous summary)
  const lastSummary = await prisma.marketSummary.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const cutoff = lastSummary
    ? lastSummary.createdAt
    : new Date(Date.now() - 14 * 60 * 60 * 1000);

  logger.info({ cutoff: cutoff.toISOString() }, 'Article lookback cutoff');

  const articles = await prisma.article.findMany({
    where: {
      status: { in: ['FETCHED', 'ENRICHED'] },
      publishedAt: { gte: cutoff },
      // Include HIGH and MEDIUM impact articles for bi-daily summary
      enrichment: {
        marketImpact: { in: ['HIGH', 'MEDIUM'] },
      },
    },
    select: {
      titleOriginal: true,
      url: true,
      originalSourceName: true,
      source: { select: { name: true } },
      enrichment: {
        select: {
          titleTh: true,
          marketImpact: true,
        },
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });

  const headlines: HeadlineItem[] = articles.map((a) => ({
    title: a.titleOriginal,
    url: a.url,
    source: a.originalSourceName || a.source.name,
  }));

  logger.info({ articleCount: headlines.length }, 'Gathered headlines for summary');

  // 2. Fetch current prices
  const prices = await fetchPrices();
  logger.info(
    { btc: prices.btc.price, fearGreed: prices.fearGreedIndex },
    'Fetched market prices'
  );

  // 3. Generate Thai summary via LLM
  const prompt = buildSummaryPrompt(headlines, prices, scheduleType);
  let summaryText = '';
  let sectionTitle = '';

  try {
    const llmResponse = await llmProvider.complete(prompt, {
      temperature: 0.4,
      maxTokens: 2000,
    });

    const parsed = JSON.parse(llmResponse);
    summaryText = parsed.market_context || '';
    sectionTitle = parsed.section_title || `สรุปตลาดคริปโต`;
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'LLM summary generation failed');
    // Fallback: post without LLM summary
    summaryText = `📊 สรุปข่าวคริปโตรอบ ${scheduleType === 'morning' ? 'เช้า' : 'เย็น'} — มีข่าว ${headlines.length} ข่าวในช่วง 12 ชั่วโมงที่ผ่านมา`;
    sectionTitle = `สรุปตลาดคริปโต ${scheduleType === 'morning' ? 'เช้า' : 'เย็น'}`;
  }

  // 4. Store summary in database
  const summary = await prisma.marketSummary.create({
    data: {
      scheduleType,
      summaryText,
      headlines: headlines as any,
      prices: prices as any,
      articleCount: headlines.length,
    },
  });

  // 5. Post to Discord (optional)
  if (webhookUrl) {
    try {
      await postSummaryToDiscord(
        webhookUrl,
        summaryText,
        sectionTitle,
        headlines,
        prices,
        scheduleType
      );

      await prisma.marketSummary.update({
        where: { id: summary.id },
        data: {
          discordPosted: true,
          discordPostedAt: new Date(),
        },
      });

      logger.info({ summaryId: summary.id, scheduleType }, 'Bi-daily summary posted to Discord');
    } catch (error) {
      await prisma.marketSummary.update({
        where: { id: summary.id },
        data: { error: (error as Error).message },
      });
      logger.error({ error: (error as Error).message }, 'Failed to post summary to Discord');
    }
  } else {
    logger.warn({ summaryId: summary.id }, 'DISCORD_WEBHOOK_URL is missing; stored summary without Discord post');
  }

  // 6. Audit
  await prisma.jobAudit.create({
    data: {
      jobType: 'GENERATE_SUMMARY',
      status: 'COMPLETED',
      metadata: {
        summaryId: summary.id,
        scheduleType,
        articleCount: headlines.length,
      },
    },
  });

  return { success: true, summaryId: summary.id };
}
