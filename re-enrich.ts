import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reEnrich() {
  // Step 1: Find all LOW impact enrichments
  const lowEnrichments = await prisma.enrichment.findMany({
    where: { marketImpact: 'LOW' },
    select: { id: true, articleId: true },
  });

  console.log(`Found ${lowEnrichments.length} LOW impact enrichments to re-evaluate`);

  // Step 2: Delete those enrichments and reset articles to FETCHED
  const articleIds = lowEnrichments.map(e => e.articleId);

  if (articleIds.length > 0) {
    await prisma.enrichment.deleteMany({
      where: { articleId: { in: articleIds } },
    });
    console.log(`Deleted ${lowEnrichments.length} LOW enrichments`);

    await prisma.article.updateMany({
      where: { id: { in: articleIds } },
      data: { status: 'FETCHED' },
    });
    console.log(`Reset ${articleIds.length} articles to FETCHED status`);
  }

  // Step 3: Show status
  const counts = {
    pending: await prisma.article.count({ where: { status: 'PENDING' } }),
    fetched: await prisma.article.count({ where: { status: 'FETCHED' } }),
    enriched: await prisma.article.count({ where: { status: 'ENRICHED' } }),
    failed: await prisma.article.count({ where: { status: 'FAILED' } }),
  };

  console.log('\nArticle status after reset:', counts);
  console.log(`\nNow run: cd apps/worker && npx tsx src/cli/run-enrich-from-api.ts`);

  await prisma.$disconnect();
}

reEnrich().catch(console.error);
