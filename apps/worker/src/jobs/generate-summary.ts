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
  articleWindowStartUtc?: string;
  articleWindowEndUtc?: string;
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

interface SummarySections {
  sectionTitle: string;
  overview: string[];
  drivers: string[];
  watch: string[];
}

interface SummaryPayload extends SummarySections {
  headlines: HeadlineItem[];
  prices: PriceData;
  scheduleType: 'morning' | 'evening';
  articleCount: number;
  summaryText: string;
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

function sanitizeBullet(text: string, maxLength = 120): string {
  return sanitizeSummaryField(text)
    .replace(/^[-•*]\s*/, '')
    .replace(/\s*[—-]\s*/g, ' ')
    .replace(/\b(sentiment|market|price action)\b/gi, (match) => match.toLowerCase())
    .replace(/\s+/g, ' ')
    .replace(/[。.!?]+$/g, '')
    .trim()
    .slice(0, maxLength)
    .trim();
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.toLowerCase();
    if (!value || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value);
  }
  return result;
}

function getScheduleMeta(scheduleType: 'morning' | 'evening') {
  return scheduleType === 'morning'
    ? {
        thaiLabel: 'เช้า',
        englishLabel: 'Morning Brief (07:00 ICT)',
        timeEmoji: '🌅',
        promptFocus: 'Frame the session ahead. Emphasize setup, positioning, and what traders should watch next.',
      }
    : {
        thaiLabel: 'เย็น',
        englishLabel: 'Evening Wrap (19:00 ICT)',
        timeEmoji: '🌆',
        promptFocus: 'Frame what changed during the session. Emphasize what held, what failed, and what carries into the next session.',
      };
}

function classifyHeadline(title: string): 'institutional' | 'policy' | 'risk' | 'market' | 'other' {
  const normalized = title.toLowerCase();
  if (/(schwab|morgan stanley|blackrock|citi|goldman|jpmorgan|bank|etf|institution|reserve)/i.test(normalized)) return 'institutional';
  if (/(sec|cftc|fca|law|regulat|policy|senate|congress|tax|stablecoin|government)/i.test(normalized)) return 'policy';
  if (/(hack|exploit|liquidat|outflow|sell|pressure|fear|crime|fraud|halt|withdrawal|pushback)/i.test(normalized)) return 'risk';
  if (/(bitcoin|btc|ethereum|eth|solana|sol|doge|xrp|market|price|funding|rally|resistance)/i.test(normalized)) return 'market';
  return 'other';
}

function scoreHeadline(item: HeadlineItem, index: number): number {
  const normalized = item.title.toLowerCase();
  let score = Math.max(0, 100 - index);
  const category = classifyHeadline(item.title);

  if (category === 'institutional') score += 35;
  if (category === 'policy') score += 28;
  if (category === 'risk') score += 24;
  if (category === 'market') score += 18;

  if (/(bitcoin|btc)/i.test(normalized)) score += 10;
  if (/(ethereum|eth|solana|sol|xrp|doge|hype)/i.test(normalized)) score += 6;
  if (/(launch|opens|launches|pilot|approve|deal|rescue|recovery|outflow|liquidation)/i.test(normalized)) score += 8;
  if (/coindesk/i.test(item.source)) score += 4;
  if (/cointelegraph/i.test(item.source)) score += 3;
  if (/decrypt/i.test(item.source)) score += 2;

  return score;
}

function rankHeadlines(headlines: HeadlineItem[]): HeadlineItem[] {
  return headlines
    .map((headline, index) => ({ headline, index, score: scoreHeadline(headline, index) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.headline);
}

function buildStructuredSummaryText(sections: SummarySections): string {
  const parts: string[] = [];
  if (sections.overview.length > 0) {
    parts.push(`🌐 ภาพรวม\n${sections.overview.map((b) => `• ${b}`).join('\n')}`);
  }
  if (sections.drivers.length > 0) {
    parts.push(`⚡ ปัจจัยขับเคลื่อน\n${sections.drivers.map((b) => `• ${b}`).join('\n')}`);
  }
  if (sections.watch.length > 0) {
    parts.push(`⚠️ จับตา\n${sections.watch.map((b) => `• ${b}`).join('\n')}`);
  }
  return parts.join('\n\n');
}

function parseStoredSections(summaryText: string, fallbackTitle: string): SummarySections {
  const sections: SummarySections = {
    sectionTitle: fallbackTitle,
    overview: [],
    drivers: [],
    watch: [],
  };

  for (const block of summaryText.split('\n\n')) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const [header, ...bullets] = lines;
    const cleanedBullets = bullets.map((bullet) => sanitizeBullet(bullet)).filter(Boolean);
    if (header.includes('ภาพรวม')) sections.overview = cleanedBullets;
    if (header.includes('ปัจจัย')) sections.drivers = cleanedBullets;
    if (header.includes('จับตา')) sections.watch = cleanedBullets;
  }

  return sections;
}

function padBullets(items: string[], minimum: number, fillers: string[]): string[] {
  const result = dedupeStrings(items).slice(0, minimum);
  for (const filler of fillers) {
    if (result.length >= minimum) break;
    if (!result.includes(filler)) result.push(filler);
  }
  return result;
}

function buildFallbackSections(
  headlines: HeadlineItem[],
  prices: PriceData,
  scheduleType: 'morning' | 'evening'
): SummarySections {
  const ranked = rankHeadlines(headlines);
  const topTitles = ranked.slice(0, 3).map((item) => item.titleTh || item.title);
  const btcBias = prices.btc.change24h >= 0 ? 'เริ่มฟื้นตัว' : 'ยังถูกกดดัน';
  const altBias = prices.sol.change24h >= 0 ? 'SOL เด่นกว่า majors' : 'altcoins ยังฟื้นไม่พร้อมกัน';
  const mood = prices.fearGreedIndex <= 25 ? 'ความกลัวสูง' : 'sentiment ยังระวังตัว';
  const meta = getScheduleMeta(scheduleType);

  return {
    sectionTitle: `${meta.thaiLabel === 'เช้า' ? 'ตลาดเช้ายัง' : 'ตลาดเย็นยัง'}เน้นระวังแรงเหวี่ยง`,
    overview: [
      sanitizeBullet(`ตลาดเคลื่อนไหว sideways ภายใต้ ${mood}`),
      sanitizeBullet(`BTC ${btcBias} ขณะที่ spot demand ยังไม่กลับมาเต็มที่`),
      sanitizeBullet(`${altBias} แต่ภาพรวมยังไม่ใช่ broad-based rally`),
    ],
    drivers: padBullets(
      topTitles.map((title) => sanitizeBullet(title, 120)),
      3,
      [
        sanitizeBullet('แรงข่าวฝั่งสถาบันและ policy ยังเป็นตัวกำหนด sentiment ระยะสั้น'),
        sanitizeBullet('กระแส funding, liquidation และ supply pressure ยังบังคับทิศทาง majors'),
        sanitizeBullet('นักลงทุนยังให้น้ำหนักกับข่าวที่กระทบ Bitcoin และ Ethereum โดยตรง'),
      ]
    ),
    watch: padBullets(
      [
        sanitizeBullet('ติดตามแรง follow-through หลัง headline หลักว่ามี spot demand รองรับหรือไม่'),
        sanitizeBullet('จับตา sentiment รอบถัดไปผ่าน funding, ETF flow และข่าว policy ใหม่'),
      ],
      2,
      [
        sanitizeBullet('ระวังแรงขายทำกำไรเมื่อราคาเข้าใกล้แนวต้านสำคัญของ BTC'),
        sanitizeBullet('ติดตามว่าเม็ดเงินจะกระจายจาก BTC ไปสู่ altcoins หรือไม่'),
      ]
    ),
  };
}

function buildValidatedSections(
  raw: Partial<SummarySections>,
  headlines: HeadlineItem[],
  prices: PriceData,
  scheduleType: 'morning' | 'evening'
): SummarySections {
  const fallback = buildFallbackSections(headlines, prices, scheduleType);
  const sectionTitle = sanitizeSummaryField(raw.sectionTitle || fallback.sectionTitle).slice(0, 50) || fallback.sectionTitle;
  const overview = padBullets(
    (raw.overview || []).map((item) => sanitizeBullet(item, 110)).filter(Boolean),
    3,
    fallback.overview
  );
  const drivers = padBullets(
    (raw.drivers || []).map((item) => sanitizeBullet(item, 110)).filter(Boolean),
    3,
    fallback.drivers
  );
  const watch = padBullets(
    (raw.watch || []).map((item) => sanitizeBullet(item, 100)).filter(Boolean),
    2,
    fallback.watch
  );

  return { sectionTitle, overview, drivers, watch };
}

function buildSummaryPayload(
  sections: SummarySections,
  headlines: HeadlineItem[],
  prices: PriceData,
  scheduleType: 'morning' | 'evening'
): SummaryPayload {
  const ranked = rankHeadlines(headlines);
  return {
    ...sections,
    headlines: ranked,
    prices,
    scheduleType,
    articleCount: headlines.length,
    summaryText: buildStructuredSummaryText(sections),
  };
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
  const meta = getScheduleMeta(scheduleType);
  const period = `${meta.thaiLabel} (รอบ ${scheduleType === 'morning' ? '7:00' : '19:00'} น.)`;
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

  return `You are a senior Thai crypto editor writing a premium bi-daily market recap for Thai crypto traders and investors.

## Mission
Write a concise market brief for the ${period} session on ${dateStr}.
This brief will appear in chat beside a headline list and market prices.

Your job is NOT to restate headlines.
Your job is to:
- identify the market state
- explain the real drivers
- tell readers what matters next

${meta.promptFocus}

## Input Context
### Market Data
- BTC: ${formatPrice(prices.btc.price)} (${formatChange(prices.btc.change24h)})
- ETH: ${formatPrice(prices.eth.price)} (${formatChange(prices.eth.change24h)})
- SOL: ${formatPrice(prices.sol.price)} (${formatChange(prices.sol.change24h)})
- HYPE: ${formatPrice(prices.hype.price)} (${formatChange(prices.hype.change24h)})
- Total Market Cap: ${formatMarketCap(prices.totalMarketCap)} (${formatChange(prices.marketCapChange24h)})
- Fear & Greed Index: ${prices.fearGreedIndex} (${prices.fearGreedLabel})

### Major Headlines (${headlines.length})
${headlinesList || '(No major headlines in this period)'}

## Editorial Workflow
Before writing the final JSON, internally do this:
1. Rank the headlines by market impact
2. Prioritize:
   - institutional adoption / large allocators
   - regulation / policy / sovereign or banking signals
   - market structure / funding / liquidation / supply pressure
   - major token-specific moves only if they affect broader sentiment
3. Ignore novelty stories unless they materially affect market tone
4. Separate your thinking into:
   - market state
   - causes
   - next triggers

Do not output this reasoning. Output JSON only.

## Writing Rules
- Write in Thai by default
- Use English only for:
  - proper names
  - company names
  - protocol names
  - token symbols
  - unavoidable market jargon
- Keep proper names in English exactly as written
- Never output Chinese characters or Han script
- Prefer natural Thai phrasing over direct translation from English
- Avoid overly academic or robotic wording
- Avoid generic filler such as:
  - "โดยรวม"
  - "ทั้งนี้"
  - "อย่างไรก็ตาม"
- Avoid generic titles like:
  - "ตลาดยังผันผวน"
  - "ตลาดคริปโตยังน่าจับตา"
- Avoid repeating the same idea across sections
- Do not repeat exact price numbers
- Do not give trading advice
- Do not simply rewrite a headline without stating why it matters

## Section Rules

### section_title
- One sharp Thai title
- Max 42 characters
- No emoji
- Must describe the market state clearly
- Must sound publishable and specific

### overview
- Exactly 3 bullets
- Describe current market structure, sentiment, and breadth
- This section is about "what the market looks like right now"
- Do NOT focus on individual headlines unless needed for context
- Each bullet must say something different

### drivers
- Exactly 3 bullets
- Each bullet must include:
  - the event / actor
  - why markets care
- Prefer causal structure:
  - "event -> implication"
- This section is about "why the market is behaving this way"

### watch
- Exactly 2 bullets
- Forward-looking only
- State what to monitor next and why it matters
- This section is about "what could change the next session"

### headlines_th
- Translate the first 15 headlines only
- Same order as input
- Keep names, companies, protocols, and symbols in English
- Natural Thai, not literal translation
- Max 100 characters each

## Bullet Quality Rules
- Each bullet should be about 45-95 characters, max 110
- Start with a strong subject or verb phrase
- No trailing punctuation
- No duplicate bullets
- No vague bullets
- No empty abstractions
- Every bullet must add new information

## Self-check Before Output
- Ensure section_title is specific, not generic
- Ensure overview/drivers/watch have exact counts
- Ensure no repeated idea appears across sections
- Ensure drivers explain implication, not just event
- Ensure watch is forward-looking
- Ensure Thai reads naturally
- Ensure output is valid JSON

## Output JSON Schema
{
  "section_title": string,
  "overview": [string, string, string],
  "drivers": [string, string, string],
  "watch": [string, string],
  "headlines_th": string[]
}

Respond ONLY with valid JSON. No markdown.`;
}

// Format and send Discord webhook
// Discord limits: embed description 4096 chars, field value 1024 chars, total 6000 chars
async function postSummaryToDiscord(
  webhookUrl: string,
  payload: SummaryPayload
): Promise<void> {
  const { summaryText, sectionTitle, headlines, prices, scheduleType } = payload;
  const meta = getScheduleMeta(scheduleType);

  // Format bullets for Discord — bold section headers + bullet lines
  const analysisLines: string[] = [];
  for (const section of summaryText.split('\n\n')) {
    const lines = section.split('\n').filter(Boolean);
    if (lines.length === 0) continue;
    const [header, ...bullets] = lines;
    if (header) analysisLines.push(`**${header}**`);
    bullets.forEach((b) => analysisLines.push(b));
    analysisLines.push('');
  }
  const analysisBlock = analysisLines.join('\n').trim();
  const maxAnalysisLen = 1500;
  const description = analysisBlock.length > maxAnalysisLen
    ? analysisBlock.substring(0, maxAnalysisLen).replace(/\s+\S*$/, '') + '...'
    : analysisBlock;

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
    `${fgEmoji} Fear & Greed: **${prices.fearGreedIndex}** — ${escapeMarkdown(prices.fearGreedLabel)}`,
  ].join('\n');

  // Headlines — use description space (4096 char limit) instead of fields (1024)
  const headlineItems = headlines.slice(0, 15);
  const headlineLines: string[] = [];

  for (const h of headlineItems) {
    const displayTitle = escapeMarkdown((h.titleTh || h.title).substring(0, 80));
    const line = `• [${displayTitle}](${h.url}) — *${escapeMarkdown(h.source)}*`;
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

  const embed = {
    title: `${meta.timeEmoji} ${sectionTitle}`,
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
  payload: SummaryPayload
): Promise<void> {
  const { sectionTitle, overview, drivers, watch, headlines, prices, scheduleType } = payload;
  const meta = getScheduleMeta(scheduleType);
  const telegramService = new TelegramService(telegramBotToken, telegramChatId);

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
    .slice(0, 10)
    .map((h, i) => {
      const displayTitle = (h.titleTh || h.title).substring(0, 96);
      return `${i + 1}. <a href="${escapeUrlForHtmlAttr(h.url)}">${escapeHtml(displayTitle)}</a>`;
    })
    .join('\n');

  const renderBulletGroup = (header: string, bullets: string[]) =>
    [
      `<b>${escapeHtml(header)}</b>`,
      ...bullets.map((bullet) => `• ${escapeHtml(bullet)}`),
      '\u200B',
    ].filter(Boolean);

  const message = [
    `${meta.timeEmoji} <b>${escapeHtml(sectionTitle)}</b>`,
    `<i>${meta.englishLabel}</i>`,
    '━━━━━━━━━━',
    '',
    ...renderBulletGroup('🌐 ภาพรวม', overview),
    ...renderBulletGroup('⚡ ปัจจัยขับเคลื่อน', drivers),
    ...renderBulletGroup('⚠️ จับตา', watch),
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
  const {
    scheduleType,
    webhookUrl,
    telegramBotToken,
    telegramChatId,
    articleWindowStartUtc,
    articleWindowEndUtc,
  } = data;

  logger.info({ scheduleType }, 'Generating bi-daily market summary');

  // 1. Get articles since the last summary (fallback: 14 hours if no previous summary)
  const overrideHours = Number(process.env.SUMMARY_LOOKBACK_HOURS) || 0;
  let cutoff: Date;
  let windowEnd: Date | undefined;

  if (articleWindowStartUtc) {
    cutoff = new Date(articleWindowStartUtc);
    if (Number.isNaN(cutoff.getTime())) {
      throw new Error(`Invalid articleWindowStartUtc: ${articleWindowStartUtc}`);
    }
    if (articleWindowEndUtc) {
      windowEnd = new Date(articleWindowEndUtc);
      if (Number.isNaN(windowEnd.getTime())) {
        throw new Error(`Invalid articleWindowEndUtc: ${articleWindowEndUtc}`);
      }
    }
  } else if (overrideHours > 0) {
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

  logger.info(
    {
      cutoff: cutoff.toISOString(),
      windowEnd: windowEnd?.toISOString(),
    },
    'Article lookback cutoff'
  );

  const articles = await prisma.article.findMany({
    where: {
      status: { in: ['FETCHED', 'ENRICHED'] },
      publishedAt: {
        gte: cutoff,
        ...(windowEnd ? { lt: windowEnd } : {}),
      },
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

  const rawHeadlines: HeadlineItem[] = articles.map((a) => ({
    title: a.titleOriginal,
    url: a.url,
    source: a.originalSourceName || a.source.name,
  }));
  let headlines = rankHeadlines(rawHeadlines);

  logger.info({ articleCount: headlines.length }, 'Gathered headlines for summary');

  // 2. Fetch current prices
  const prices = await fetchPrices();
  logger.info(
    { btc: prices.btc.price, fearGreed: prices.fearGreedIndex },
    'Fetched market prices'
  );

  // 3. Generate Thai summary via LLM
  const prompt = buildSummaryPrompt(headlines, prices, scheduleType);
  let payload: SummaryPayload;

  try {
    const llmResponse = await llmProvider.complete(prompt, {
      temperature: 0.4,
      maxTokens: 2500,
    });

    const parsed = JSON.parse(llmResponse);
    const headlinesTh: string[] = Array.isArray(parsed.headlines_th) ? parsed.headlines_th : [];
    headlinesTh.forEach((titleTh, i) => {
      if (headlines[i] && typeof titleTh === 'string' && titleTh.trim()) {
        headlines[i] = {
          ...headlines[i],
          titleTh: sanitizeHeadlineTranslation(titleTh.trim(), headlines[i].title),
        };
      }
    });

    const sections = buildValidatedSections(
      {
        sectionTitle: parsed.section_title,
        overview: Array.isArray(parsed.overview) ? parsed.overview : [],
        drivers: Array.isArray(parsed.drivers) ? parsed.drivers : [],
        watch: Array.isArray(parsed.watch) ? parsed.watch : [],
      },
      headlines,
      prices,
      scheduleType
    );
    payload = buildSummaryPayload(sections, headlines, prices, scheduleType);
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'LLM summary generation failed');
    const fallbackSections = buildFallbackSections(headlines, prices, scheduleType);
    payload = buildSummaryPayload(fallbackSections, headlines, prices, scheduleType);
  }

  // 4. Store summary in database
  const summary = await prisma.marketSummary.create({
    data: {
      scheduleType,
      summaryText: payload.summaryText,
      headlines: payload.headlines as any,
      prices: prices as any,
      articleCount: headlines.length,
    },
  });

  // 5. Post to Discord/Telegram (optional)
  const postErrors: string[] = [];

  if (webhookUrl) {
    try {
      await postSummaryToDiscord(webhookUrl, payload);

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
      await postSummaryToTelegram(telegramBotToken, telegramChatId, payload);
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
