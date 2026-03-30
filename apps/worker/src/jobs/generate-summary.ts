import { PrismaClient } from '@prisma/client';
import { createLogger, escapeMarkdown } from '@crypto-news/shared';
import type { LLMProviderInterface } from '@crypto-news/shared';
import { TelegramService, escapeHtml } from '../services/telegram.js';

const logger = createLogger('worker:job:generate-summary');

export interface GenerateSummaryJobData {
  scheduleType: 'morning' | 'evening';
  webhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}

interface HeadlineItem {
  title: string;
  titleTh?: string; // Thai translation (set after LLM response)
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

const HAN_SCRIPT_REGEX = /\p{Script=Han}+/gu;

function stripHanScript(text: string): string {
  return text.replace(HAN_SCRIPT_REGEX, ' ');
}

function sanitizeSummaryField(text: string): string {
  return stripHanScript(text)
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeHeadlineTranslation(titleTh: string | undefined, fallbackTitle: string): string | undefined {
  if (!titleTh) return undefined;
  const cleaned = stripHanScript(titleTh);
  return cleaned || fallbackTitle;
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
Your analysis will be displayed alongside a price table and a headline list — so do NOT repeat price numbers or list news headlines. They are already shown separately.

**IMPORTANT**: The headlines below are PRE-FILTERED to show only HIGH and MEDIUM impact news. Use HIGH impact stories as the core of your analysis and MEDIUM stories to support broader trends.

## Market Data (reference only — do NOT quote these numbers directly)
- BTC: ${formatPrice(prices.btc.price)} (${formatChange(prices.btc.change24h)})
- ETH: ${formatPrice(prices.eth.price)} (${formatChange(prices.eth.change24h)})
- SOL: ${formatPrice(prices.sol.price)} (${formatChange(prices.sol.change24h)})
- HYPE: ${formatPrice(prices.hype.price)} (${formatChange(prices.hype.change24h)})
- Total Market Cap: ${formatMarketCap(prices.totalMarketCap)} (${formatChange(prices.marketCapChange24h)})
- Fear & Greed Index: ${prices.fearGreedIndex} (${prices.fearGreedLabel})

## HIGH & MEDIUM IMPACT News Headlines (${headlines.length} major stories since last summary):
${headlinesList || '(No major headlines in this period)'}

## Output Format
Write a JSON response with exactly these fields:

1. "section_title": A punchy Thai title capturing today's market mood (max 50 chars, no emoji)

2. "overview": Array of exactly 3 bullet strings — macro market direction and sentiment
   - What is the overall market structure right now? Trending, sideways, recovering, or distributing?
   - Use Fear & Greed and price action as context clues (without quoting exact numbers)
   - Each bullet = one distinct, concrete observation about the market state

3. "drivers": Array of 2–3 bullet strings — specific catalysts moving the market this session
   - What are the 2–3 most important stories actually driving price action?
   - Be specific: name the project, institution, or event AND explain the implication
   - Weave the most impactful headlines in naturally as evidence, not as a recap

4. "watch": Array of 1–2 bullet strings — what traders should monitor in the next session
   - Forward-looking: key levels, upcoming events, emerging risks, or structural shifts
   - Be concrete — vague warnings are not useful

5. "headlines_th": Array of Thai-translated headline titles — translate the FIRST 15 headlines from the list above (same order)
   - Translate only the title text, keep it natural Thai — not word-for-word
   - Keep proper names, project names, company names, and token symbols in English (e.g. "Bitcoin", "BlackRock", "SEC", "ETH")
   - Max 100 characters per translated title
   - Return exactly 15 strings (or fewer if there are fewer than 15 headlines)

## Language Rules (apply to ALL bullet fields)
- Write predominantly Thai. Use English ONLY for: crypto/finance jargon + specific proper names
- KEEP all proper names in English — NEVER transliterate: "Bitcoin" not "บิทคอยน์", "Binance" not "ไบแนนซ์"
- NEVER output Chinese characters or Han script anywhere in the response
- Common Thai vocabulary must stay Thai: "สะท้อน" not "reflect", "ครอง" not "dominate", "ส่งสัญญาณ" not "signal"
- Aim for ~80% Thai, ~20% English (jargon + names only)
- Each bullet: max 120 characters. Start with a strong subject or verb phrase. No trailing punctuation.
- No filler openers ("ทั้งนี้", "อย่างไรก็ตาม", "โดยรวม")
- No trading advice (no "buy", "sell", "entry", "stop-loss")
- Tone: sharp and analytical — observe and interpret, do not advise

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

  // Format bullets for Discord — bold section headers + bullet lines
  const analysisLines: string[] = [];
  for (const section of summaryText.split('\n\n')) {
    const lines = section.split('\n').filter(Boolean);
    if (lines.length === 0) continue;
    const [header, ...bullets] = lines;
    if (header) analysisLines.push(`**${header}**`);
    bullets.forEach(b => analysisLines.push(b));
    analysisLines.push('');
  }
  const analysisBlock = analysisLines.join('\n').trim();
  const maxAnalysisLen = 1500;
  const description = analysisBlock.length > maxAnalysisLen
    ? analysisBlock.substring(0, maxAnalysisLen).replace(/\s+\S*$/, '') + '...'
    : analysisBlock;

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

  // Headlines — use description space (4096 char limit) instead of fields (1024)
  const headlineItems = headlines.slice(0, 15);
  const headlineLines: string[] = [];

  for (const h of headlineItems) {
    const displayTitle = (h.titleTh || h.title).substring(0, 80);
    const line = `• [${displayTitle}](${h.url}) — *${h.source}*`;
    headlineLines.push(line);
  }

  const headlinesBlock = `**📰 ข่าวเด่น ${headlineLines.length} ข่าว**\n${headlineLines.join('\n')}`;

  // Combine summary + headlines in description (4096 char limit)
  const fullDescription = `${description}\n\n${headlinesBlock}`;
  const safeDescription = fullDescription.length > 4090
    ? fullDescription.substring(0, 4090) + '...'
    : fullDescription;

  // Build fields — prices only
  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    {
      name: '💰 ราคาตลาด',
      value: priceField,
      inline: false,
    },
  ];

  // Build the embed
  const embed = {
    title: `${timeEmoji} ${sectionTitle}`,
    description: safeDescription,
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

async function postSummaryToTelegram(
  telegramBotToken: string,
  telegramChatId: string,
  summaryText: string,
  sectionTitle: string,
  headlines: HeadlineItem[],
  prices: PriceData,
  scheduleType: 'morning' | 'evening'
): Promise<void> {
  const timeEmoji = scheduleType === 'morning' ? '🌅' : '🌆';
  const telegramService = new TelegramService(telegramBotToken, telegramChatId);
  const summaryLabel = scheduleType === 'morning' ? 'Morning Brief (07:00 ICT)' : 'Evening Wrap (19:00 ICT)';

  const escapeUrlForHtmlAttr = (url: string): string =>
    url
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '%3C')
      .replace(/>/g, '%3E');

  const coinLines = [
    `BTC ${formatPrice(prices.btc.price)} (${formatChange(prices.btc.change24h)})`,
    `ETH ${formatPrice(prices.eth.price)} (${formatChange(prices.eth.change24h)})`,
    `SOL ${formatPrice(prices.sol.price)} (${formatChange(prices.sol.change24h)})`,
    `HYPE ${formatPrice(prices.hype.price)} (${formatChange(prices.hype.change24h)})`,
  ];

  const headlineLines = headlines
    .slice(0, 8)
    .map((h, i) => {
      const displayTitle = (h.titleTh || h.title).substring(0, 100);
      return `${i + 1}. <a href="${escapeUrlForHtmlAttr(h.url)}">${escapeHtml(displayTitle)}</a>`;
    })
    .join('\n');

  // Format bullets for Telegram — bold section headers in HTML
  const analysisHtmlLines: string[] = [];
  for (const section of summaryText.split('\n\n')) {
    const lines = section.split('\n').filter(Boolean);
    if (lines.length === 0) continue;
    const [header, ...bullets] = lines;
    if (header) analysisHtmlLines.push(`<b>${escapeHtml(header)}</b>`);
    bullets.forEach(b => analysisHtmlLines.push(escapeHtml(b)));
    analysisHtmlLines.push('');
  }
  const analysisHtml = analysisHtmlLines.join('\n').trim();

  const message = [
    `${timeEmoji} <b>${escapeHtml(sectionTitle)}</b>`,
    `<i>${summaryLabel}</i>`,
    '━━━━━━━━━━',
    '',
    analysisHtml.substring(0, 1700),
    '',
    '━━━━━━━━━━',
    headlineLines ? `<b>📰 ข่าวเด่น ${headlineLines.split('\n').length} ข่าว</b>` : '',
    headlineLines,
    '',
    '━━━━━━━━━━',
    '<b>💰 ราคาตลาด</b>',
    ...coinLines.map((line) => `• ${escapeHtml(line)}`),
    `• MCap ${escapeHtml(formatMarketCap(prices.totalMarketCap))} (${escapeHtml(formatChange(prices.marketCapChange24h))})`,
    `• Fear & Greed ${escapeHtml(String(prices.fearGreedIndex))} (${escapeHtml(prices.fearGreedLabel)})`,
  ].filter(Boolean).join('\n');

  await telegramService.sendHtmlMessage(message);
}

// Main job processor
export async function processGenerateSummaryJob(
  data: GenerateSummaryJobData,
  prisma: PrismaClient,
  llmProvider: LLMProviderInterface
): Promise<{ success: boolean; summaryId: string }> {
  const { scheduleType, webhookUrl, telegramBotToken, telegramChatId } = data;

  logger.info({ scheduleType }, 'Generating bi-daily market summary');

  // 1. Get articles since the last summary (fallback: 14 hours if no previous summary)
  const overrideHours = Number(process.env.SUMMARY_LOOKBACK_HOURS) || 0;
  let cutoff: Date;
  if (overrideHours > 0) {
    cutoff = new Date(Date.now() - overrideHours * 60 * 60 * 1000);
  } else {
    const lastSummary = await prisma.marketSummary.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    cutoff = lastSummary
      ? lastSummary.createdAt
      : new Date(Date.now() - 14 * 60 * 60 * 1000);
  }

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
      maxTokens: 2500,
    });

    const parsed = JSON.parse(llmResponse);
    sectionTitle = sanitizeSummaryField(parsed.section_title || `สรุปตลาดคริปโต`);

    const overview: string[] = Array.isArray(parsed.overview)
      ? parsed.overview.map((item: string) => sanitizeSummaryField(item)).filter(Boolean)
      : [];
    const drivers: string[] = Array.isArray(parsed.drivers)
      ? parsed.drivers.map((item: string) => sanitizeSummaryField(item)).filter(Boolean)
      : [];
    const watch: string[] = Array.isArray(parsed.watch)
      ? parsed.watch.map((item: string) => sanitizeSummaryField(item)).filter(Boolean)
      : [];

    // Merge Thai headline translations into headlines array
    const headlinesTh: string[] = Array.isArray(parsed.headlines_th) ? parsed.headlines_th : [];
    headlinesTh.forEach((titleTh, i) => {
      if (headlines[i] && typeof titleTh === 'string' && titleTh.trim()) {
        headlines[i] = {
          ...headlines[i],
          titleTh: sanitizeHeadlineTranslation(titleTh.trim(), headlines[i].title),
        };
      }
    });

    // Build flat section text — compatible with feed UI and Discord/Telegram rendering
    const parts: string[] = [];
    if (overview.length > 0) {
      parts.push(`🌐 ภาพรวม\n${overview.map(b => `• ${b}`).join('\n')}`);
    }
    if (drivers.length > 0) {
      parts.push(`⚡ ปัจจัยขับเคลื่อน\n${drivers.map(b => `• ${b}`).join('\n')}`);
    }
    if (watch.length > 0) {
      parts.push(`⚠️ จับตา\n${watch.map(b => `• ${b}`).join('\n')}`);
    }
    summaryText = parts.join('\n\n');
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'LLM summary generation failed');
    summaryText = `📊 สรุปข่าวคริปโตรอบ ${scheduleType === 'morning' ? 'เช้า' : 'เย็น'} — มีข่าว ${headlines.length} ข่าวในช่วง 12 ชั่วโมงที่ผ่านมา`;
    sectionTitle = `สรุปตลาดคริปโต ${scheduleType === 'morning' ? 'เช้า' : 'เย็น'}`;
  }

  sectionTitle = sanitizeSummaryField(sectionTitle) || `สรุปตลาดคริปโต ${scheduleType === 'morning' ? 'เช้า' : 'เย็น'}`;
  summaryText = sanitizeSummaryField(summaryText);

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

  // 5. Post to Discord/Telegram (optional)
  const postErrors: string[] = [];

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
      postErrors.push(`discord: ${(error as Error).message}`);
      logger.error({ error: (error as Error).message }, 'Failed to post summary to Discord');
    }
  }

  if (telegramBotToken && telegramChatId) {
    try {
      await postSummaryToTelegram(
        telegramBotToken,
        telegramChatId,
        summaryText,
        sectionTitle,
        headlines,
        prices,
        scheduleType
      );
      logger.info({ summaryId: summary.id, scheduleType }, 'Bi-daily summary posted to Telegram');
    } catch (error) {
      postErrors.push(`telegram: ${(error as Error).message}`);
      logger.error({ error: (error as Error).message }, 'Failed to post summary to Telegram');
    }
  }

  if (!webhookUrl && !(telegramBotToken && telegramChatId)) {
    logger.warn(
      { summaryId: summary.id },
      'No notification hub configured; stored summary without Discord/Telegram post'
    );
  }

  if (postErrors.length > 0) {
    await prisma.marketSummary.update({
      where: { id: summary.id },
      data: { error: postErrors.join(' | ') },
    });
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
