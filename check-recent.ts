import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const recent = await prisma.article.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { titleOriginal: true, createdAt: true, publishedAt: true, status: true, source: { select: { name: true } } }
  });

  console.log('=== 5 Most Recently Created Articles ===');
  recent.forEach(a => {
    console.log(`  [${a.status}] ${a.source.name} | created: ${a.createdAt.toISOString()} | published: ${a.publishedAt?.toISOString() || 'null'}`);
    console.log(`    "${a.titleOriginal}"`);
  });

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60*60*1000);
  const threeHoursAgo = new Date(now.getTime() - 3*60*60*1000);

  const last1h = await prisma.article.count({ where: { createdAt: { gte: oneHourAgo } } });
  const last3h = await prisma.article.count({ where: { createdAt: { gte: threeHoursAgo } } });

  console.log('\n=== Ingestion Rate ===');
  console.log(`  Last 1h: ${last1h} | Last 3h: ${last3h}`);
  console.log(`  Now (UTC): ${now.toISOString()}`);

  const sourceStats = await prisma.source.findMany({
    select: {
      name: true,
      type: true,
      enabled: true,
      _count: { select: { articles: true } },
    },
    orderBy: { name: 'asc' },
  });
  console.log('\n=== Sources (Enabled + Article Count) ===');
  sourceStats.forEach((s) =>
    console.log(`  [${s.enabled ? 'EN' : 'DIS'}] ${s.type} ${s.name}: ${s._count.articles} articles`)
  );

  await prisma.$disconnect();
}
check();
