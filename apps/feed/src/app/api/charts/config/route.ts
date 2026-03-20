import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function normalizeChartsBases(rawValue?: string | null) {
  const fallbackHost = 'noon-hub-charts-api-production.up.railway.app';
  const raw = (rawValue || fallbackHost).trim();

  if (raw.startsWith('wss://')) {
    return {
      wsBase: raw,
      httpBase: raw.replace(/^wss:\/\//, 'https://'),
    };
  }

  if (raw.startsWith('ws://')) {
    return {
      wsBase: raw,
      httpBase: raw.replace(/^ws:\/\//, 'http://'),
    };
  }

  if (raw.startsWith('https://')) {
    return {
      wsBase: raw.replace(/^https:\/\//, 'wss://'),
      httpBase: raw,
    };
  }

  if (raw.startsWith('http://')) {
    return {
      wsBase: raw.replace(/^http:\/\//, 'ws://'),
      httpBase: raw,
    };
  }

  return {
    wsBase: `wss://${raw}`,
    httpBase: `https://${raw}`,
  };
}

export async function GET() {
  const configured =
    process.env.NEXT_PUBLIC_CHARTS_API_URL ||
    process.env.CHARTS_API_URL ||
    process.env.RAILWAY_SERVICE_NOON_HUB_CHARTS_API_URL;

  const { wsBase, httpBase } = normalizeChartsBases(configured);

  return NextResponse.json(
    {
      wsBase,
      httpBase,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
}
