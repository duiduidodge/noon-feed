import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTitles() {
  const articles = await prisma.article.findMany({
    where: { status: 'ENRICHED' },
    select: { titleOriginal: true },
    take: 5,
  });

  console.log('Sample article titles:');
  articles.forEach((a, i) => {
    console.log(`${i + 1}. "${a.titleOriginal}"`);
  });

  // Check for emoji pattern
  const hasEmoji = articles.some(a => /[\u{1F300}-\u{1F9FF}]/u.test(a.titleOriginal));
  console.log(`\nTitles contain emojis: ${hasEmoji}`);

  await prisma.$disconnect();
}

checkTitles();
