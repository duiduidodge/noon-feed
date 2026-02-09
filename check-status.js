// Check article processing status
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStatus() {
  const statusCounts = await prisma.article.groupBy({
    by: ['status'],
    _count: true,
  });

  console.log('\n📊 Article Processing Status:\n');
  console.log('═'.repeat(50));

  statusCounts.forEach(({ status, _count }) => {
    console.log(`${status.padEnd(12)} : ${_count}`);
  });

  const recentArticles = await prisma.article.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      source: true,
      enrichment: true,
    },
  });

  console.log('\n📰 Recent Articles:\n');
  console.log('═'.repeat(50));

  recentArticles.forEach((article, i) => {
    console.log(`${i + 1}. [${article.status}] ${article.titleOriginal.substring(0, 60)}...`);
    console.log(`   Source: ${article.source.name}`);
    console.log(`   Enriched: ${article.enrichment ? '✅' : '❌'}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkStatus().catch(console.error);
