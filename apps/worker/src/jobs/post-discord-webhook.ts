import { PrismaClient } from '@prisma/client';
import { createLogger } from '@crypto-news/shared';
import { DiscordWebhookService } from '../services/discord-webhook.js';

const logger = createLogger('worker:job:post-discord-webhook');

export interface PostDiscordWebhookJobData {
  postingId: string;
  webhookUrl: string;
}

export async function processPostDiscordWebhookJob(
  data: PostDiscordWebhookJobData,
  prisma: PrismaClient
): Promise<{ success: boolean }> {
  const { postingId, webhookUrl } = data;

  logger.info({ postingId }, 'Processing Discord webhook post job');

  // Get posting with article and enrichment
  const posting = await prisma.posting.findUnique({
    where: { id: postingId },
    include: {
      article: {
        include: {
          source: true,
          enrichment: true,
        },
      },
    },
  });

  if (!posting) {
    throw new Error(`Posting not found: ${postingId}`);
  }

  const { article } = posting;
  const enrichment = article.enrichment;
  if (!enrichment) {
    throw new Error('Article has no enrichment');
  }

  // Audit start
  await prisma.jobAudit.create({
    data: {
      jobType: 'POST_DISCORD',
      articleId: article.id,
      status: 'STARTED',
      metadata: { postingId },
    },
  });

  try {
    // Create webhook service
    const webhookService = new DiscordWebhookService(webhookUrl);

    // Post to Discord
    await webhookService.postArticle({
      ...article,
      enrichment,
    });

    // Update posting
    await prisma.posting.update({
      where: { id: postingId },
      data: {
        postedAt: new Date(),
        status: 'POSTED',
      },
    });

    // Audit complete
    await prisma.jobAudit.create({
      data: {
        jobType: 'POST_DISCORD',
        articleId: article.id,
        status: 'COMPLETED',
        metadata: { postingId },
      },
    });

    logger.info({ postingId }, 'Discord webhook post job completed');

    return { success: true };
  } catch (error) {
    // Update posting as failed
    await prisma.posting.update({
      where: { id: postingId },
      data: {
        status: 'FAILED',
        error: (error as Error).message,
      },
    });

    // Audit failure
    await prisma.jobAudit.create({
      data: {
        jobType: 'POST_DISCORD',
        articleId: article.id,
        status: 'FAILED',
        error: (error as Error).message,
        metadata: { postingId },
      },
    });

    logger.error({ error: (error as Error).message, postingId }, 'Discord webhook post job failed');
    throw error;
  }
}
