import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFinalStats() {
  // Overall stats
  const totalArticles = await prisma.article.count();
  const enrichedArticles = await prisma.article.count({ where: { status: 'ENRICHED' } });
  
  // Impact distribution
  const impactStats = await prisma.$queryRaw<Array<{
    marketImpact: string;
    count: bigint;
  }>>`
    SELECT 
      e."marketImpact",
      COUNT(*) as count
    FROM "Enrichment" e
    JOIN "Article" a ON a.id = e."articleId"
    WHERE a.status = 'ENRICHED'
    GROUP BY e."marketImpact"
    ORDER BY e."marketImpact";
  `;

  // Sentiment distribution
  const sentimentStats = await prisma.$queryRaw<Array<{
    sentiment: string;
    count: bigint;
  }>>`
    SELECT 
      e.sentiment,
      COUNT(*) as count
    FROM "Enrichment" e
    JOIN "Article" a ON a.id = e."articleId"
    WHERE a.status = 'ENRICHED'
    GROUP BY e.sentiment
    ORDER BY e.sentiment;
  `;

  console.log('📊 Final Database Statistics:\n');
  console.log('Total Articles:', totalArticles);
  console.log('Enriched Articles:', enrichedArticles);
  console.log(`Enrichment Rate: ${((enrichedArticles/totalArticles)*100).toFixed(1)}%\n`);
  
  console.log('Impact Distribution:');
  impactStats.forEach(stat => {
    const percentage = ((Number(stat.count) / enrichedArticles) * 100).toFixed(1);
    console.log(`  ${stat.marketImpact}: ${stat.count} (${percentage}%)`);
  });
  
  console.log('\nSentiment Distribution:');
  sentimentStats.forEach(stat => {
    const percentage = ((Number(stat.count) / enrichedArticles) * 100).toFixed(1);
    console.log(`  ${stat.sentiment}: ${stat.count} (${percentage}%)`);
  });

  console.log('\n💰 Cost Savings Calculation:');
  console.log(`  Before: 100% LLM enrichment = ${totalArticles} articles × $0.20 = $${(totalArticles * 0.20).toFixed(2)}/day`);
  console.log(`  After: Free API enrichment for all articles = $0.00/day`);
  console.log(`  HIGH impact Thai translation only = ${impactStats.find(s => s.marketImpact === 'HIGH')?.count || 0} articles × $0.05 = $${(Number(impactStats.find(s => s.marketImpact === 'HIGH')?.count || 0) * 0.05).toFixed(2)}/day`);
  
  const mediumHighCount = impactStats.filter(s => ['MEDIUM', 'HIGH'].includes(s.marketImpact))
    .reduce((sum, s) => sum + Number(s.count), 0);
  console.log(`\n✅ Feed showing ${mediumHighCount} MEDIUM + HIGH impact articles (${((mediumHighCount/enrichedArticles)*100).toFixed(1)}% of total)`);

  await prisma.$disconnect();
}

checkFinalStats().catch(console.error);
