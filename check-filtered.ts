import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Recent articles WITH impact level
  const recent = await prisma.article.findMany({
    where: { status: 'ENRICHED' },
    orderBy: { publishedAt: 'desc' },
    take: 10,
    select: { 
      titleOriginal: true, publishedAt: true,
      enrichment: { select: { marketImpact: true } }
    }
  });

  console.log('=== 10 Most Recent Articles (all impacts) ===');
  recent.forEach(a => {
    const impact = a.enrichment?.marketImpact || 'NONE';
    const marker = impact === 'HIGH' ? '🔴' : impact === 'MEDIUM' ? '🟡' : '⚪';
    const ago = a.publishedAt ? Math.round((Date.now() - a.publishedAt.getTime()) / 3600000) + 'h ago' : 'unknown';
    console.log(`  ${marker} [${impact.padEnd(6)}] ${ago.padEnd(8)} ${a.titleOriginal.slice(0,80)}`);
  });

  // Count by impact in recent articles
  const recentHigh = await prisma.article.count({
    where: { status: 'ENRICHED', publishedAt: { gte: new Date(Date.now() - 6*3600000) }, enrichment: { marketImpact: 'HIGH' } }
  });
  const recentMed = await prisma.article.count({
    where: { status: 'ENRICHED', publishedAt: { gte: new Date(Date.now() - 6*3600000) }, enrichment: { marketImpact: 'MEDIUM' } }
  });
  const recentLow = await prisma.article.count({
    where: { status: 'ENRICHED', publishedAt: { gte: new Date(Date.now() - 6*3600000) }, enrichment: { marketImpact: 'LOW' } }
  });

  console.log(`\n=== Last 6 hours ===`);
  console.log(`  HIGH: ${recentHigh} | MEDIUM: ${recentMed} | LOW: ${recentLow}`);
  console.log(`  Feed shows: ${recentHigh + recentMed} (HIGH+MEDIUM only)`);
  console.log(`  Filtered out: ${recentLow} (LOW impact)`);

  await prisma.$disconnect();
}
check();
