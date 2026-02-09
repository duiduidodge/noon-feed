const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check the FETCHED articles — are they from allowed sources? Do they have text?
  const fetched = await p.article.findMany({
    where: { status: 'FETCHED' },
    select: {
      id: true,
      titleOriginal: true,
      originalSourceName: true,
      extractedText: true,
      createdAt: true,
      source: { select: { name: true, type: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  console.log('=== FETCHED articles (oldest 20) ===');
  fetched.forEach(a => {
    const src = a.originalSourceName || a.source.name;
    const type = a.source.type;
    const textLen = a.extractedText ? a.extractedText.length : 0;
    const age = Math.round((Date.now() - a.createdAt.getTime()) / 60000);
    console.log('  [' + type + '] ' + src.padEnd(20) + ' text:' + String(textLen).padStart(5) + ' chars  age:' + age + 'min  ' + a.titleOriginal.substring(0, 50));
  });

  // Check recent job audits for enrichment
  const audits = await p.jobAudit.findMany({
    where: { jobType: 'ENRICH_ARTICLE' },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log('\n=== Recent Enrichment Job Audits ===');
  audits.forEach(a => {
    const time = a.createdAt.toISOString().slice(11, 19);
    const err = a.error ? ' ERR: ' + a.error.substring(0, 80) : '';
    console.log('  ' + time + ' ' + a.status + err);
  });

  // Check if any enrichment jobs exist in BullMQ (via job audits pattern)
  const recentStarted = await p.jobAudit.count({
    where: {
      jobType: 'ENRICH_ARTICLE',
      status: 'STARTED',
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  const recentCompleted = await p.jobAudit.count({
    where: {
      jobType: 'ENRICH_ARTICLE',
      status: 'COMPLETED',
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  const recentFailed = await p.jobAudit.count({
    where: {
      jobType: 'ENRICH_ARTICLE',
      status: 'FAILED',
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  console.log('\n=== Enrichment jobs (last hour) ===');
  console.log('  Started:', recentStarted);
  console.log('  Completed:', recentCompleted);
  console.log('  Failed:', recentFailed);

  await p.$disconnect();
}

main();
