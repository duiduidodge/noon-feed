import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const articles = await prisma.article.findMany({
    where: {
      status: 'ENRICHED',
      enrichment: {
        marketImpact: 'HIGH',
        titleTh: { not: null },
      },
      postings: {
        none: {
          postingType: 'HIGH_IMPACT',
        },
      },
    },
    include: {
      enrichment: { select: { titleTh: true, summaryTh: true } },
    },
    take: 3,
  });

  console.log(`Found ${articles.length} postable articles:\n`);
  articles.forEach((a, i) => {
    console.log(`${i + 1}. ${a.enrichment?.titleTh || a.titleOriginal}`);
  });

  await prisma.$disconnect();
}

check();
