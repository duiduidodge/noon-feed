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

function parseEmergingSignal(signal: string | null | undefined): { asset: string; direction: string } {
  const parts = (signal || '').trim().split(/\s+/).filter(Boolean);
  const asset = toToken(parts[0] || '');
  const rawDirection = (parts[1] || '').toUpperCase();
  const direction = rawDirection === 'SHORT' ? 'SHORT' : 'LONG';
  return { asset, direction };
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

    const whaleTopScore = whaleSnapshot?.traders?.[0]?.score
      ? Number(whaleSnapshot.traders[0].score)
      : null;
    const whaleBackdropBonus = whaleTopScore != null && whaleTopScore >= 80 ? 4 : 0;

    const emergingByToken = new Map<
      string,
      { immediate: boolean; deep: boolean; direction: string; rank: number | null; traders: number | null; reasonCount: number }
    >();
    for (const alert of emergingSnapshot?.alerts || []) {
      const parsed = parseEmergingSignal(alert.signal);
      const token = parsed.asset;
      if (!token) continue;
      const current = emergingByToken.get(token) || {
        immediate: false,
        deep: false,
        direction: (alert.direction || parsed.direction || 'LONG').toUpperCase(),
        rank: alert.currentRank,
        traders: alert.traders,
        reasonCount: 0,
      };
      emergingByToken.set(token, {
        immediate: current.immediate || alert.isImmediate,
        deep: current.deep || alert.isDeepClimber,
        direction: current.direction || (alert.direction || parsed.direction || 'LONG').toUpperCase(),
        rank: current.rank ?? alert.currentRank,
        traders: current.traders ?? alert.traders,
        reasonCount: Math.max(current.reasonCount, alert.reasonCount || 0),
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
      const confidence = Math.min(99, scoreBase + trendBonus + emergingBonus + whaleBackdropBonus);

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

    if (setups.length === 0) {
      for (const [token, emerging] of emergingByToken.entries()) {
        const base = emerging.immediate ? 78 : emerging.deep ? 72 : 66;
        const confidence = Math.min(
          96,
          base + Math.min(10, emerging.reasonCount || 0) + whaleBackdropBonus
        );
        const thesis = [
          emerging.immediate ? 'immediate mover' : emerging.deep ? 'deep climber' : 'emerging activity',
          emerging.rank != null ? `rank #${emerging.rank}` : null,
          emerging.traders != null ? `${emerging.traders} traders` : null,
          (emerging.reasonCount || 0) > 0 ? `${emerging.reasonCount} signals` : null,
        ]
          .filter(Boolean)
          .join(' • ');

        setups.push({
          id: `emerging-${token}`,
          asset: token,
          direction: (emerging.direction || 'LONG').toUpperCase(),
          confidence,
          thesis,
        });
      }
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
        whaleTopScore,
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
