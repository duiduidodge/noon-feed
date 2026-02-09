import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { TAG_VOCABULARY, formatDateThai } from '@crypto-news/shared';
import type { Sentiment, MarketImpact } from '@crypto-news/shared';

const SENTIMENT_COLORS: Record<Sentiment, number> = {
  bullish: 0x00ff00,
  bearish: 0xff0000,
  neutral: 0x808080,
};

const MARKET_IMPACT_EMOJI: Record<MarketImpact, string> = {
  high: '🔥',
  medium: '⚡',
  low: '📝',
};

export const data = new SlashCommandBuilder()
  .setName('news')
  .setDescription('Crypto news commands')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('latest')
      .setDescription('Get latest crypto news')
      .addStringOption((option) =>
        option
          .setName('tag')
          .setDescription('Filter by tag')
          .setRequired(false)
          .addChoices(...TAG_VOCABULARY.slice(0, 25).map((tag) => ({ name: tag, value: tag })))
      )
      .addIntegerOption((option) =>
        option
          .setName('limit')
          .setDescription('Number of articles (1-10)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(10)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('post')
      .setDescription('Post an article to the channel')
      .addStringOption((option) =>
        option.setName('article_id').setDescription('Article ID to post').setRequired(true)
      )
  )
  .addSubcommand((subcommand) => subcommand.setName('sources').setDescription('List all news sources'))
  .addSubcommand((subcommand) => subcommand.setName('stats').setDescription('Show news statistics'));

export async function execute(interaction: ChatInputCommandInteraction, prisma: PrismaClient) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'latest':
      return handleLatest(interaction, prisma);
    case 'post':
      return handlePost(interaction, prisma);
    case 'sources':
      return handleSources(interaction, prisma);
    case 'stats':
      return handleStats(interaction, prisma);
    default:
      await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
  }
}

async function handleLatest(interaction: ChatInputCommandInteraction, prisma: PrismaClient) {
  await interaction.deferReply();

  const tag = interaction.options.getString('tag');
  const limit = interaction.options.getInteger('limit') || 5;

  // Build query
  const where: any = {
    status: 'ENRICHED',
    enrichment: { isNot: null },
  };

  if (tag) {
    where.enrichment = {
      ...where.enrichment,
      tags: { array_contains: [tag] },
    };
  }

  const articles = await prisma.article.findMany({
    where,
    include: {
      source: { select: { name: true } },
      enrichment: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });

  if (articles.length === 0) {
    await interaction.editReply('ไม่พบข่าวที่ตรงกับเงื่อนไข');
    return;
  }

  const embeds = articles.map((article) => {
    const e = article.enrichment!;
    const sentiment = e.sentiment.toLowerCase() as Sentiment;
    const marketImpact = e.marketImpact.toLowerCase() as MarketImpact;
    const tags = e.tags as string[];

    return new EmbedBuilder()
      .setTitle(`${MARKET_IMPACT_EMOJI[marketImpact]} ${e.titleTh}`)
      .setURL(article.url)
      .setDescription(e.summaryTh)
      .setColor(SENTIMENT_COLORS[sentiment])
      .addFields(
        { name: 'Sentiment', value: sentiment, inline: true },
        { name: 'Impact', value: marketImpact, inline: true },
        { name: 'Tags', value: tags.map((t) => `\`${t}\``).join(' '), inline: true }
      )
      .setFooter({ text: `${article.source.name} | ${formatDateThai(article.publishedAt)}` })
      .setTimestamp(article.publishedAt || undefined);
  });

  await interaction.editReply({ embeds: embeds.slice(0, 10) }); // Discord limit: 10 embeds
}

async function handlePost(interaction: ChatInputCommandInteraction, prisma: PrismaClient) {
  await interaction.deferReply({ ephemeral: true });

  const articleId = interaction.options.getString('article_id', true);

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      source: { select: { name: true } },
      enrichment: true,
    },
  });

  if (!article) {
    await interaction.editReply('ไม่พบบทความที่ระบุ');
    return;
  }

  if (!article.enrichment) {
    await interaction.editReply('บทความยังไม่ได้รับการประมวลผล');
    return;
  }

  // Create posting record
  const posting = await prisma.posting.create({
    data: {
      articleId,
      discordChannelId: interaction.channelId,
      status: 'PENDING',
    },
  });

  await interaction.editReply(`บทความถูกจัดคิวสำหรับโพสต์แล้ว (Posting ID: ${posting.id})`);
}

async function handleSources(interaction: ChatInputCommandInteraction, prisma: PrismaClient) {
  await interaction.deferReply();

  const sources = await prisma.source.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { articles: true } },
    },
  });

  const embed = new EmbedBuilder()
    .setTitle('📰 News Sources')
    .setColor(0x5865f2)
    .setDescription(
      sources
        .map(
          (s) =>
            `${s.enabled ? '✅' : '❌'} **${s.name}** (${s.type})\n└ ${s._count.articles} articles`
        )
        .join('\n\n')
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleStats(interaction: ChatInputCommandInteraction, prisma: PrismaClient) {
  await interaction.deferReply();

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalArticles, enrichedArticles, postedToday, postedWeek, bySentiment] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: 'ENRICHED' } }),
    prisma.posting.count({
      where: { postedAt: { gte: todayStart }, status: 'POSTED' },
    }),
    prisma.posting.count({
      where: { postedAt: { gte: weekStart }, status: 'POSTED' },
    }),
    prisma.enrichment.groupBy({
      by: ['sentiment'],
      _count: { id: true },
    }),
  ]);

  const sentimentStats = bySentiment.reduce(
    (acc, s) => {
      acc[s.sentiment.toLowerCase()] = s._count.id;
      return acc;
    },
    {} as Record<string, number>
  );

  const embed = new EmbedBuilder()
    .setTitle('📊 News Statistics')
    .setColor(0x5865f2)
    .addFields(
      { name: '📰 Total Articles', value: totalArticles.toString(), inline: true },
      { name: '✅ Enriched', value: enrichedArticles.toString(), inline: true },
      { name: '📤 Posted Today', value: postedToday.toString(), inline: true },
      { name: '📤 Posted This Week', value: postedWeek.toString(), inline: true },
      {
        name: '📈 Sentiment',
        value: `🟢 Bullish: ${sentimentStats['bullish'] || 0}\n🔴 Bearish: ${sentimentStats['bearish'] || 0}\n⚪ Neutral: ${sentimentStats['neutral'] || 0}`,
        inline: true,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
