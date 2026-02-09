const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Overall status counts
  const statuses = await p.$queryRaw`
    SELECT status, COUNT(*) as count FROM "Article" GROUP BY status ORDER BY count DESC
  `;
  console.log('=== Article Status Breakdown ===');
  statuses.forEach(s => console.log('  ' + String(s.count).padStart(4) + '  ' + s.status));

  // Enriched articles (what the feed shows)
  const enriched = await p.article.findMany({
    where: { status: 'ENRICHED', enrichment: { isNot: null } },
    select: {
      id: true,
      titleOriginal: true,
      originalSourceName: true,
      publishedAt: true,
      source: { select: { name: true, type: true } },
    },
    orderBy: { publishedAt: 'desc' },
    take: 15,
  });

  console.log('\n=== Feed Articles (ENRICHED, latest 15) ===');
  enriched.forEach(a => {
    const src = a.originalSourceName || a.source.name;
    const type = a.source.type;
    const time = a.publishedAt ? a.publishedAt.toISOString().slice(0, 16) : 'no date';
    console.log('  [' + type + '] ' + src.padEnd(22) + ' ' + time + '  ' + a.titleOriginal.substring(0, 65));
  });

  // Pending/Fetched articles waiting in pipeline
  const pending = await p.article.count({ where: { status: 'PENDING' } });
  const fetched = await p.article.count({ where: { status: 'FETCHED' } });
  console.log('\n=== Pipeline Queue ===');
  console.log('  PENDING (waiting for HTML fetch):', pending);
  console.log('  FETCHED (waiting for enrichment):', fetched);

  // Recent failed articles
  const failed = await p.article.findMany({
    where: { status: 'FAILED' },
    select: { titleOriginal: true, originalSourceName: true, source: { select: { name: true } }, url: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  if (failed.length > 0) {
    console.log('\n=== Recent FAILED ===');
    failed.forEach(a => {
      const src = a.originalSourceName || a.source.name;
      console.log('  ' + src + ' | ' + a.titleOriginal.substring(0, 60));
    });
  }

  // Check if any FETCHED articles are stuck (old but not enriched)
  const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
  const stuck = await p.article.count({
    where: { status: 'FETCHED', createdAt: { lt: stuckThreshold } },
  });
  if (stuck > 0) {
    console.log('\n⚠️  ' + stuck + ' articles stuck in FETCHED status for >30 min');
  }

  // Check latest enrichment timestamps
  const latestEnrichment = await p.enrichment.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, articleId: true },
  });
  if (latestEnrichment) {
    console.log('\n=== Last Enrichment ===');
    console.log('  ', latestEnrichment.createdAt.toISOString());
    const minAgo = Math.round((Date.now() - latestEnrichment.createdAt.getTime()) / 60000);
    console.log('  ', minAgo, 'minutes ago');
  }

  await p.$disconnect();
}

main();
