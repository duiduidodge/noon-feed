import { PrismaClient } from '@prisma/client';
import { createLogger, formatDateThai, escapeMarkdown, getChannelForTags } from '@crypto-news/shared';
import type { ChannelRouting, Sentiment, MarketImpact } from '@crypto-news/shared';

const logger = createLogger('worker:job:post-discord');

export interface PostDiscordJobData {
  postingId: string;
  botToken: string;
  channelRouting: ChannelRouting[];
}

export interface DiscordMessage {
  embeds: DiscordEmbed[];
}

export interface DiscordEmbed {
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

export async function processPostDiscordJob(
  data: PostDiscordJobData,
  prisma: PrismaClient
): Promise<{ success: boolean; messageId?: string }> {
  const { postingId, botToken, channelRouting } = data;

  logger.info({ postingId }, 'Processing Discord post job');

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
      metadata: { postingId, channelId: posting.discordChannelId },
    },
  });

  try {
    // Determine channel if not specified
    const tags = enrichment.tags as string[];
    const channelId = posting.discordChannelId || getChannelForTags(tags, channelRouting);

    if (!channelId) {
      throw new Error('No channel ID available');
    }

    // Build Discord embed
    const sentiment = enrichment.sentiment.toLowerCase() as Sentiment;
    const marketImpact = enrichment.marketImpact.toLowerCase() as MarketImpact;
    const embed: DiscordEmbed = {
      title: `${MARKET_IMPACT_EMOJI[marketImpact]} ${enrichment.titleTh}`,
      description: `**📝 สรุป:**\n${escapeMarkdown(enrichment.summaryTh)}`,
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

    // Send to Discord
    const messageId = await sendDiscordMessage(botToken, channelId, { embeds: [embed] });

    // Update posting
    await prisma.posting.update({
      where: { id: postingId },
      data: {
        discordMessageId: messageId,
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
        metadata: { postingId, channelId, messageId },
      },
    });

    logger.info({ postingId, channelId, messageId }, 'Discord post job completed');

    return { success: true, messageId };
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

    logger.error({ error: (error as Error).message, postingId }, 'Discord post job failed');
    throw error;
  }
}

async function sendDiscordMessage(
  botToken: string,
  channelId: string,
  message: DiscordMessage
): Promise<string> {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord API error: ${response.status} - ${error}`);
  }

  const result = (await response.json()) as { id: string };
  return result.id;
}
