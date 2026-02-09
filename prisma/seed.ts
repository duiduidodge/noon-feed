import { PrismaClient, SourceType } from '@prisma/client';

const prisma = new PrismaClient();

const defaultSources = [
  {
    name: 'CoinDesk',
    type: SourceType.RSS,
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    category: 'general',
    enabled: true,
  },
  {
    name: 'CoinTelegraph',
    type: SourceType.RSS,
    url: 'https://cointelegraph.com/rss',
    category: 'general',
    enabled: true,
  },
  {
    name: 'The Block',
    type: SourceType.RSS,
    url: 'https://www.theblock.co/rss.xml',
    category: 'general',
    enabled: true,
  },
  {
    name: 'Decrypt',
    type: SourceType.RSS,
    url: 'https://decrypt.co/feed',
    category: 'general',
    enabled: true,
  },
  {
    name: 'Bitcoin Magazine',
    type: SourceType.RSS,
    url: 'https://bitcoinmagazine.com/feed',
    category: 'bitcoin',
    enabled: true,
  },
  {
    name: 'DeFi Pulse',
    type: SourceType.RSS,
    url: 'https://defipulse.com/blog/feed/',
    category: 'defi',
    enabled: true,
  },
  {
    name: 'Blockworks',
    type: SourceType.RSS,
    url: 'https://blockworks.co/feed/',
    category: 'general',
    enabled: true,
  },
  {
    name: 'CryptoSlate',
    type: SourceType.RSS,
    url: 'https://cryptoslate.com/feed/',
    category: 'general',
    enabled: true,
  },
];

async function main() {
  console.log('Seeding database...');

  for (const source of defaultSources) {
    const existing = await prisma.source.findUnique({
      where: { url: source.url },
    });

    if (!existing) {
      await prisma.source.create({
        data: source,
      });
      console.log(`Created source: ${source.name}`);
    } else {
      console.log(`Source already exists: ${source.name}`);
    }
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
