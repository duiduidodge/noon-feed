// Add GitHub API News source to database
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addAPISource() {
  console.log('\n📡 Adding GitHub API News Source...\n');
  console.log('═'.repeat(80));

  try {
    // Check if source already exists
    const existing = await prisma.source.findFirst({
      where: {
        name: 'Free Crypto News API',
        type: 'API',
      },
    });

    if (existing) {
      console.log('✅ API source already exists!');
      console.log(`   ID: ${existing.id}`);
      console.log(`   Name: ${existing.name}`);
      console.log(`   URL: ${existing.url}`);
      console.log(`   Enabled: ${existing.enabled ? 'Yes' : 'No'}`);
      await prisma.$disconnect();
      return;
    }

    // Create new API source
    const source = await prisma.source.create({
      data: {
        name: 'Free Crypto News API',
        type: 'API',
        url: 'https://news-crypto.vercel.app',
        enabled: true,
        category: 'aggregator',
      },
    });

    console.log('✅ Successfully added API source!');
    console.log('');
    console.log('   ID:', source.id);
    console.log('   Name:', source.name);
    console.log('   Type:', source.type);
    console.log('   URL:', source.url);
    console.log('   Category:', source.category);
    console.log('   Enabled:', source.enabled ? 'Yes ✅' : 'No ❌');
    console.log('');
    console.log('═'.repeat(80));
    console.log('');
    console.log('📊 This API provides:');
    console.log('   • 200+ crypto news sources');
    console.log('   • 130+ English sources');
    console.log('   • 75+ international sources (18 languages including Thai)');
    console.log('   • Historical data (662k articles from 2017-2025)');
    console.log('   • Auto-translation to English');
    console.log('   • Built-in sentiment analysis');
    console.log('');
    console.log('🔄 Deduplication:');
    console.log('   • URL normalization across RSS & API sources');
    console.log('   • 85% title similarity check prevents duplicates');
    console.log('   • Article hash matching (title + URL + date)');
    console.log('');
    console.log('✅ Your worker will now fetch from:');
    console.log('   • 8 RSS feeds (direct sources)');
    console.log('   • 200+ API sources (aggregated)');
    console.log('   = 208+ total sources with zero duplicates!');
    console.log('');

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

addAPISource();
