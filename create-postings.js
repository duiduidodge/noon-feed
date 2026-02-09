// Manually create Discord postings for enriched articles
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createPostings() {
  // Get enriched articles without postings
  const enrichedArticles = await prisma.article.findMany({
    where: {
      status: 'ENRICHED',
      postings: { none: {} },
    },
    include: {
      enrichment: true,
    },
  });

  console.log(`\n📤 Creating Discord postings for ${enrichedArticles.length} enriched articles...\n`);

  for (const article of enrichedArticles) {
    await prisma.posting.create({
      data: {
        articleId: article.id,
        discordChannelId: 'webhook',
        status: 'PENDING',
      },
    });

    console.log(`✅ Created posting for: ${article.enrichment.titleTh}`);
  }

  console.log(`\n✅ Created ${enrichedArticles.length} postings!\n`);

  await prisma.$disconnect();
}

createPostings().catch(console.error);
