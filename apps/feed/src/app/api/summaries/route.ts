import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summaries = await prisma.marketSummary.findMany({
      where: {
        discordPosted: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 4, // Show last 2 days (morning + evening)
      select: {
        id: true,
        scheduleType: true,
        summaryText: true,
        headlines: true,
        prices: true,
        articleCount: true,
        createdAt: true,
      },
    });

    return NextResponse.json(summaries);
  } catch (error) {
    console.error('Failed to fetch summaries:', error);
    return NextResponse.json({ error: 'Failed to fetch summaries' }, { status: 500 });
  }
}
