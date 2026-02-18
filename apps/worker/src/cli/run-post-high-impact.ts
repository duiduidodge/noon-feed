import { PrismaClient } from '@prisma/client';
import { createLogger } from '@crypto-news/shared';
import { DiscordArticlePoster } from '../services/discord-article-poster.js';
import { TelegramService, escapeHtml } from '../services/telegram.js';

const logger = createLogger('worker:cli:post-high-impact');
const prisma = new PrismaClient();

async function postHighImpact() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  const discordPoster = webhookUrl ? new DiscordArticlePoster(webhookUrl) : null;
  const telegramService = telegramBotToken && telegramChatId
    ? new TelegramService(telegramBotToken, telegramChatId)
    : null;

  if (!discordPoster && !telegramService) {
    logger.error('No notification hub configured. Set DISCORD_WEBHOOK_URL and/or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID');
    process.exit(1);
  }

  logger.info('Starting HIGH impact article posting');

  // Find HIGH impact articles with Thai translation that haven't been posted
  const articles = await prisma.article.findMany({
    where: {
      status: 'ENRICHED',
      enrichment: {
        marketImpact: 'HIGH',
        titleTh: { not: null },
      },
      postings: {
        none: {
          postingType: 'HIGH_IMPACT',
        },
      },
    },
    include: {
      enrichment: true,
      source: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: 5, // Limit to 5 for testing
  });

  logger.info({ count: articles.length }, 'Found HIGH impact articles to post');

  if (articles.length === 0) {
    logger.info('No articles to post');
    return;
  }

  let posted = 0;

  for (const article of articles) {
    try {
      const errors: string[] = [];
      let delivered = false;

      if (discordPoster) {
        try {
          await discordPoster.postHighImpactArticle(article);
          delivered = true;
        } catch (error) {
          errors.push(`discord: ${(error as Error).message}`);
        }
      }

      if (telegramService && article.enrichment) {
        try {
          const title = article.enrichment.titleTh || article.titleOriginal;
          const summary = article.enrichment.summaryTh || article.extractedText?.substring(0, 1000) || '';
          const message = [
            `🔥 <b>${escapeHtml(title)}</b>`,
            '',
            escapeHtml(summary),
            '',
            `<b>Impact:</b> ${escapeHtml(article.enrichment.marketImpact)}`,
            `<b>Sentiment:</b> ${escapeHtml(article.enrichment.sentiment)}`,
            `<b>Source:</b> ${escapeHtml(article.originalSourceName || article.source.name)}`,
            `<a href="${article.url}">Read full article</a>`,
          ].join('\n');

          await telegramService.sendHtmlMessage(message);
          delivered = true;
        } catch (error) {
          errors.push(`telegram: ${(error as Error).message}`);
        }
      }

      if (!delivered) {
        throw new Error(errors.join(' | ') || 'Failed to deliver notification');
      }

      // Mark as posted
      await prisma.posting.create({
        data: {
          articleId: article.id,
          discordChannelId: 'high-impact-webhook',
          status: 'POSTED',
          postingType: 'HIGH_IMPACT',
          postedAt: new Date(),
        },
      });

      posted++;
      logger.info({ articleId: article.id, partialDeliveryErrors: errors.length > 0 ? errors : undefined }, 'Article posted successfully');

      // Rate limiting: 10 seconds between posts
      await new Promise(resolve => setTimeout(resolve, 10000));

    } catch (error) {
      logger.error({ 
        articleId: article.id, 
        error: (error as Error).message 
      }, 'Failed to post article');
    }
  }

  logger.info({ posted }, 'Posting run complete');
  await prisma.$disconnect();
}

postHighImpact().catch((error) => {
  logger.error({ error: error.message }, 'Posting run failed');
  process.exit(1);
});
