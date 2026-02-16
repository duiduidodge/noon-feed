import { createLogger, formatDateThai, escapeMarkdown } from '@crypto-news/shared';
import type { Sentiment, MarketImpact } from '@crypto-news/shared';

const logger = createLogger('worker:discord-webhook');

export interface WebhookMessage {
  embeds: WebhookEmbed[];
}

export interface WebhookEmbed {
  title: string;
  description: string;
  url: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  footer: { text: string };
  timestamp?: string;
}

// Sentiment colors
const SENTIMENT_COLORS: Record<Sentiment, number> = {
  bullish: 0x00ff00, // Green
  bearish: 0xff0000, // Red
  neutral: 0x808080, // Gray
};

// Market impact indicators
const MARKET_IMPACT_EMOJI: Record<MarketImpact, string> = {
  high: '🔥',
  medium: '⚡',
  low: '📝',
};

export interface DiscordArticle {
  url: string;
  titleOriginal: string;
  extractedText?: string | null;
  publishedAt: Date | null;
  source: { name: string };
  enrichment: {
    titleTh: string | null;
    summaryTh: string | null;
    tags: unknown;
    sentiment: string;
    marketImpact: string;
  };
}

export class DiscordWebhookService {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async postArticle(article: DiscordArticle): Promise<void> {
    const { enrichment } = article;
    const sentiment = enrichment.sentiment.toLowerCase() as Sentiment;
    const marketImpact = enrichment.marketImpact.toLowerCase() as MarketImpact;
    const tags = enrichment.tags as string[];

    const title = enrichment.titleTh || article.titleOriginal;
    const summary = enrichment.summaryTh || article.extractedText || 'No summary available';

    const embed: WebhookEmbed = {
      title: `${MARKET_IMPACT_EMOJI[marketImpact]} ${title}`,
      description: `**📝 สรุป:**\n${escapeMarkdown(summary)}`,
      url: article.url,
      color: SENTIMENT_COLORS[sentiment],
      fields: [
        {
          name: '📰 หัวข้อต้นฉบับ',
          value: escapeMarkdown(article.titleOriginal.substring(0, 256)),
          inline: false,
        },
        {
          name: '📊 Sentiment',
          value: sentiment === 'bullish' ? '🟢 Bullish' : sentiment === 'bearish' ? '🔴 Bearish' : '⚪ Neutral',
          inline: true,
        },
        {
          name: '💥 Impact',
          value: marketImpact.charAt(0).toUpperCase() + marketImpact.slice(1),
          inline: true,
        },
        {
          name: '🏷️ Tags',
          value: tags.map((t) => `\`${t}\``).join(' '),
          inline: true,
        },
      ],
      footer: {
        text: `📡 ${article.source.name} | ${formatDateThai(article.publishedAt)}`,
      },
      timestamp: article.publishedAt?.toISOString(),
    };

    const message: WebhookMessage = { embeds: [embed] };

    await this.sendWebhook(message);
  }

  private async sendWebhook(message: WebhookMessage): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord webhook error: ${response.status} - ${error}`);
    }

    logger.info('Successfully posted to Discord via webhook');
  }
}
