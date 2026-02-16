import { PrismaClient } from '@prisma/client';
import { createLogger } from '@crypto-news/shared';
import { DiscordArticlePoster } from '../services/discord-article-poster.js';

const logger = createLogger('worker:cli:post-high-impact');
const prisma = new PrismaClient();

async function postHighImpact() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    logger.error('DISCORD_WEBHOOK_URL not configured');
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

  const poster = new DiscordArticlePoster(webhookUrl);
  let posted = 0;

  for (const article of articles) {
    try {
      // Post to Discord
      await poster.postHighImpactArticle(article);

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
      logger.info({ articleId: article.id }, 'Article posted successfully');

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
