import { createLogger, stripCJK, truncate } from '@crypto-news/shared';
import type { Article, Enrichment, Source } from '@prisma/client';

const logger = createLogger('worker:service:discord-article-poster');

interface ArticleWithEnrichment extends Article {
  enrichment: Enrichment | null;
  source: Source;
}

export class DiscordArticlePoster {
  constructor(private webhookUrl: string) {}

  async postHighImpactArticle(article: ArticleWithEnrichment): Promise<void> {
    if (!article.enrichment) {
      throw new Error('Article has no enrichment');
    }

    const { enrichment } = article;
    const rawTitle = enrichment.titleTh || article.titleOriginal;
    const rawSummary = enrichment.summaryTh || article.extractedText?.substring(0, 300) || '';
    const titleTh = stripCJK(rawTitle).trim() || 'สรุปข่าวคริปโต';
    const summaryTh = truncate(stripCJK(rawSummary).replace(/\s+/g, ' ').trim(), 900);

    // Sentiment emoji
    const sentimentEmoji = {
      BULLISH: '📈',
      BEARISH: '📉',
      NEUTRAL: '➖',
    }[enrichment.sentiment] || '➖';

    // Impact color
    const color = {
      HIGH: 0xef4444, // Red
      MEDIUM: 0xf59e0b, // Orange
      LOW: 0x10b981, // Green
    }[enrichment.marketImpact] || 0x6b7280;

    const embed = {
      title: `${sentimentEmoji} ${titleTh}`,
      description: summaryTh,
      url: article.url,
      color,
      fields: [
        {
          name: 'Source',
          value: article.originalSourceName || article.source.name,
          inline: true,
        },
        {
          name: 'Impact',
          value: enrichment.marketImpact,
          inline: true,
        },
        {
          name: 'Sentiment',
          value: enrichment.sentiment,
          inline: true,
        },
      ],
      footer: {
        text: 'Crypto News Bot',
      },
    };

    const payload = {
      embeds: [embed],
    };

    logger.info({ articleId: article.id, title: titleTh }, 'Posting article to Discord');

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord webhook failed: ${response.status} ${errorText}`);
    }

    logger.info({ articleId: article.id }, 'Successfully posted to Discord');
  }
}
