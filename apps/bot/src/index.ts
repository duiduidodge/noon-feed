import { Client, GatewayIntentBits, Events, Collection, ChatInputCommandInteraction } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { createLogger, buildConfig, sleep } from '@crypto-news/shared';
import * as newsCommand from './commands/news.js';

const logger = createLogger('bot');
const config = buildConfig();
const prisma = new PrismaClient();

// Create Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// Command collection
interface Command {
  data: { name: string };
  execute: (interaction: ChatInputCommandInteraction, prisma: PrismaClient) => Promise<void>;
}

const commands = new Collection<string, Command>();
commands.set(newsCommand.data.name, newsCommand);

// Ready event
client.once(Events.ClientReady, (readyClient) => {
  logger.info({ username: readyClient.user.tag }, 'Discord bot is ready!');
});

// Interaction handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    logger.warn({ commandName: interaction.commandName }, 'Unknown command');
    return;
  }

  try {
    await command.execute(interaction, prisma);
  } catch (error) {
    logger.error(
      {
        commandName: interaction.commandName,
        error: (error as Error).message,
      },
      'Error executing command'
    );

    const errorMessage = 'เกิดข้อผิดพลาดในการประมวลผลคำสั่ง';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// Posting processor - checks for pending posts and sends them
async function processPendingPosts() {
  while (true) {
    try {
      const pendingPosts = await prisma.posting.findMany({
        where: { status: 'PENDING' },
        include: {
          article: {
            include: {
              source: true,
              enrichment: true,
            },
          },
        },
        take: 5,
        orderBy: { createdAt: 'asc' },
      });

      for (const posting of pendingPosts) {
        if (!posting.article.enrichment) {
          await prisma.posting.update({
            where: { id: posting.id },
            data: { status: 'FAILED', error: 'No enrichment data' },
          });
          continue;
        }

        try {
          const channel = await client.channels.fetch(posting.discordChannelId);
          if (!channel || !channel.isTextBased()) {
            throw new Error('Channel not found or not text-based');
          }

          const e = posting.article.enrichment;
          const sentiment = e.sentiment.toLowerCase();
          const marketImpact = e.marketImpact.toLowerCase();
          const tags = e.tags as string[];

          const sentimentColors: Record<string, number> = {
            bullish: 0x00ff00,
            bearish: 0xff0000,
            neutral: 0x808080,
          };

          const impactEmoji: Record<string, string> = {
            high: '🔥',
            medium: '⚡',
            low: '📝',
          };

          const embed = {
            title: `${impactEmoji[marketImpact]} ${e.titleTh}`,
            description: `**📝 สรุป:**\n${e.summaryTh}`,
            url: posting.article.url,
            color: sentimentColors[sentiment],
            fields: [
              {
                name: '📰 หัวข้อต้นฉบับ',
                value: posting.article.titleOriginal.substring(0, 256),
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
              text: `📡 ${posting.article.source.name} | ${posting.article.publishedAt?.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) || 'Unknown'}`,
            },
            timestamp: posting.article.publishedAt?.toISOString(),
          };

          const message = await (channel as any).send({ embeds: [embed] });

          await prisma.posting.update({
            where: { id: posting.id },
            data: {
              discordMessageId: message.id,
              postedAt: new Date(),
              status: 'POSTED',
            },
          });

          logger.info({ postingId: posting.id, channelId: posting.discordChannelId }, 'Successfully posted to Discord');

          // Rate limit: wait between posts
          await sleep(2000);
        } catch (error) {
          await prisma.posting.update({
            where: { id: posting.id },
            data: { status: 'FAILED', error: (error as Error).message },
          });

          logger.error({ postingId: posting.id, error: (error as Error).message }, 'Failed to post to Discord');
        }
      }
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Error in posting processor');
    }

    await sleep(5000); // Check every 5 seconds
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down bot...');
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start bot
async function main() {
  logger.info('Starting Discord bot...');

  await client.login(config.discord.token);

  // Start posting processor after bot is ready
  client.once(Events.ClientReady, () => {
    processPendingPosts();
  });
}

main().catch((error) => {
  logger.error({ error: error.message }, 'Bot fatal error');
  process.exit(1);
});
