import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function stats() {
  const total = await prisma.article.count();
  const enriched = await prisma.article.count({ where: { status: 'ENRICHED' } });
  const high = await prisma.article.count({
    where: { enrichment: { marketImpact: 'HIGH' } }
  });
  const medium = await prisma.article.count({
    where: { enrichment: { marketImpact: 'MEDIUM' } }
  });
  const withThai = await prisma.article.count({
    where: { enrichment: { titleTh: { not: null } } }
  });
  const posted = await prisma.posting.count({
    where: { postingType: 'HIGH_IMPACT' }
  });

  console.log('\n📊 Current Database State:\n');
  console.log(`Total Articles: ${total}`);
  console.log(`Enriched: ${enriched} (${((enriched/total)*100).toFixed(1)}%)`);
  console.log(`HIGH Impact: ${high} (${((high/enriched)*100).toFixed(1)}%)`);
  console.log(`MEDIUM Impact: ${medium} (${((medium/enriched)*100).toFixed(1)}%)`);
  console.log(`With Thai Translation: ${withThai}`);
  console.log(`Posted to Discord: ${posted}`);
  console.log(`\nFeed Display: ${high + medium} articles (MEDIUM + HIGH)`);
  
  await prisma.$disconnect();
}
stats();
