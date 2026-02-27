import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface SetupItem {
  id: string;
  asset: string;
  direction: string;
  confidence: number;
  thesis: string;
}

function toToken(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export async function GET() {
  try {
    const { prisma } = await import('@/lib/prisma');

    const [opportunitySnapshot, emergingSnapshot, whaleSnapshot] = await Promise.all([
      prisma.opportunitySnapshot.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          opportunities: {
            orderBy: [{ finalScore: 'desc' }, { scanStreak: 'desc' }],
            take: 20,
          },
        },
      }),
      prisma.emergingMoverSnapshot.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          alerts: {
            orderBy: [{ isImmediate: 'desc' }, { currentRank: 'asc' }],
            take: 20,
          },
        },
      }),
      prisma.whaleSnapshot.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          traders: {
            orderBy: [{ score: 'desc' }, { rank: 'asc' }],
            take: 5,
          },
        },
      }),
    ]);

    const emergingByToken = new Map<string, { immediate: boolean; deep: boolean }>();
    for (const alert of emergingSnapshot?.alerts || []) {
      const token = toToken(alert.signal);
      if (!token) continue;
      const current = emergingByToken.get(token) || { immediate: false, deep: false };
      emergingByToken.set(token, {
        immediate: current.immediate || alert.isImmediate,
        deep: current.deep || alert.isDeepClimber,
      });
    }

    const setups: SetupItem[] = [];
    for (const item of opportunitySnapshot?.opportunities || []) {
      const token = toToken(item.asset);
      if (!token) continue;

      const trendBonus = item.trendAligned ? 6 : 0;
      const scoreBase = Math.min(85, Math.max(45, Math.round((item.finalScore || 0) / 3)));
      const emerging = emergingByToken.get(token);
      const emergingBonus = emerging ? (emerging.immediate ? 10 : emerging.deep ? 6 : 3) : 0;
      const confidence = Math.min(99, scoreBase + trendBonus + emergingBonus);

      const thesisBits = [
        `score ${item.finalScore ?? '-'}`,
        `streak ${item.scanStreak ?? 0}`,
        item.hourlyTrend ? item.hourlyTrend.toLowerCase() : null,
        emerging?.immediate ? 'immediate mover' : emerging?.deep ? 'deep climber' : null,
      ].filter(Boolean);

      setups.push({
        id: item.id,
        asset: token,
        direction: (item.direction || 'LONG').toUpperCase(),
        confidence,
        thesis: thesisBits.join(' • '),
      });
    }

    const ranked = setups.sort((a, b) => b.confidence - a.confidence).slice(0, 6);

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        snapshotTimes: {
          opportunity: opportunitySnapshot?.scanTime?.toISOString?.() || null,
          emerging: emergingSnapshot?.signalTime?.toISOString?.() || null,
          whale: whaleSnapshot?.scanTime?.toISOString?.() || null,
        },
        whaleTopScore: whaleSnapshot?.traders?.[0]?.score
          ? Number(whaleSnapshot.traders[0].score)
          : null,
        setups: ranked,
      },
      {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      }
    );
  } catch (error) {
    console.error('Failed to build trade setups:', error);
    return NextResponse.json({ error: 'Failed to build trade setups' }, { status: 500 });
  }
}
