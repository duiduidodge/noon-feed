// Post 3 latest enriched articles to Discord
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function post3Articles() {
  console.log('\n📤 Creating Discord postings for 3 latest articles...\n');
  console.log('═'.repeat(80));

  try {
    // Get 3 enriched articles without postings
    const enrichedArticles = await prisma.article.findMany({
      where: {
        status: 'ENRICHED',
        postings: { none: {} },
      },
      include: {
        enrichment: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    if (enrichedArticles.length === 0) {
      console.log('⚠️  No enriched articles available for posting.');
      console.log('   Worker is still processing...');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Found ${enrichedArticles.length} enriched articles ready to post\n`);

    for (const article of enrichedArticles) {
      await prisma.posting.create({
        data: {
          articleId: article.id,
          discordChannelId: 'webhook',
          status: 'PENDING',
        },
      });

      console.log(`📨 Queued: ${article.enrichment.titleTh.substring(0, 60)}...`);
      console.log(`   Sentiment: ${article.enrichment.sentiment} | Impact: ${article.enrichment.marketImpact}`);
      console.log(`   Tags: ${article.enrichment.tags.join(', ')}`);
      console.log('');
    }

    console.log('═'.repeat(80));
    console.log(`✅ Successfully queued ${enrichedArticles.length} articles for Discord!`);
    console.log('   Worker will post them within 10-20 seconds...\n');

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

post3Articles();
