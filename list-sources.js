// Quick script to list all sources from database
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listSources() {
  const sources = await prisma.source.findMany({
    orderBy: { name: 'asc' },
  });

  console.log('\n📡 RSS Feed Sources:\n');
  console.log('═'.repeat(80));

  sources.forEach((source, index) => {
    const status = source.enabled ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${source.name}`);
    console.log(`   URL: ${source.url}`);
    console.log(`   Category: ${source.category || 'general'}`);
    console.log(`   Type: ${source.type}`);
    console.log('');
  });

  console.log('═'.repeat(80));
  console.log(`Total sources: ${sources.length}`);
  console.log(`Enabled: ${sources.filter(s => s.enabled).length}`);
  console.log(`Disabled: ${sources.filter(s => !s.enabled).length}\n`);

  await prisma.$disconnect();
}

listSources().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
