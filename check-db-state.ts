import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkState() {
  const stats = await prisma.$queryRaw<Array<{
    fetched_count: bigint;
    enriched_count: bigint;
    enrichment_count: bigint;
  }>>`
    SELECT
      COUNT(*) FILTER (WHERE status = 'FETCHED') as fetched_count,
      COUNT(*) FILTER (WHERE status = 'ENRICHED') as enriched_count,
      COUNT(e.id) as enrichment_count
    FROM "Article" a
    LEFT JOIN "Enrichment" e ON e."articleId" = a.id;
  `;

  console.log('Database State:');
  console.log('- FETCHED articles:', Number(stats[0].fetched_count));
  console.log('- ENRICHED articles:', Number(stats[0].enriched_count));
  console.log('- Enrichment records:', Number(stats[0].enrichment_count));

  const sampleEnriched = await prisma.article.findFirst({
    where: { status: 'ENRICHED' },
    include: { enrichment: { select: { marketImpact: true, sentiment: true, tags: true } } },
  });

  if (sampleEnriched) {
    console.log('\nSample ENRICHED article:');
    console.log('- Title:', sampleEnriched.titleOriginal);
    console.log('- Impact:', sampleEnriched.enrichment?.marketImpact);
    console.log('- Sentiment:', sampleEnriched.enrichment?.sentiment);
    console.log('- Tags:', sampleEnriched.enrichment?.tags);
  }

  await prisma.$disconnect();
}

checkState().catch(console.error);
