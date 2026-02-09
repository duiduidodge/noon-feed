// Check enriched articles and Discord posts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEnriched() {
  // Get enriched articles
  const enrichedArticles = await prisma.article.findMany({
    where: { status: 'ENRICHED' },
    include: {
      source: true,
      enrichment: true,
      postings: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\n✅ Found ${enrichedArticles.length} ENRICHED articles\n`);
  console.log('═'.repeat(80));

  enrichedArticles.forEach((article, i) => {
    console.log(`\n${i + 1}. ${article.enrichment.titleTh}`);
    console.log(`   Original: ${article.titleOriginal.substring(0, 60)}...`);
    console.log(`   Source: ${article.source.name}`);
    console.log(`   Sentiment: ${article.enrichment.sentiment} | Impact: ${article.enrichment.marketImpact}`);
    console.log(`   Tags: ${article.enrichment.tags.join(', ')}`);
    console.log(`   Posted to Discord: ${article.postings.length > 0 ? '✅ Yes' : '❌ Not yet'}`);

    if (article.postings.length > 0) {
      article.postings.forEach(p => {
        console.log(`     - Status: ${p.status}${p.postedAt ? ' at ' + p.postedAt.toISOString() : ''}`);
      });
    }
  });

  // Check postings
  const postings = await prisma.posting.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`\n\n📮 Discord Postings:\n`);
  console.log('═'.repeat(80));
  console.log(`Total postings: ${postings.length}`);

  const byStatus = postings.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  await prisma.$disconnect();
}

checkEnriched().catch(console.error);
