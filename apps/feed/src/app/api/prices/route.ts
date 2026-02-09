import { NextResponse } from 'next/server';

interface PriceCache {
  data: any;
  timestamp: number;
}

let assetsCache: PriceCache | null = null;
const CACHE_TTL = 60_000; // 60 seconds

const MAJOR_IDS = ['bitcoin', 'ethereum', 'solana', 'hyperliquid', 'ripple'];

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,%\s,]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

// CoinGecko free API (primary)
async function fetchFromCoinGecko() {
  const response = await fetch(
    // Use top 100 to keep majors present even during volatile rank moves.
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false',
    { headers: { Accept: 'application/json' }, cache: 'no-store' }
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const coins: any[] = await response.json();

  const allPrices = coins.map((coin, index) => ({
    id: coin.id,
    rank: coin.market_cap_rank || index + 1,
    name: coin.name,
    symbol: coin.symbol.toUpperCase(),
    image: coin.image,
    priceUsd: toNumber(coin.current_price),
    changePercent24Hr: toNumber(coin.price_change_percentage_24h),
    marketCapUsd: toNumber(coin.market_cap),
    volumeUsd24Hr: toNumber(coin.total_volume),
  }));

  // Split into majors and others
  const majors = allPrices.filter((p) => MAJOR_IDS.includes(p.id));
  const others = allPrices.filter((p) => !MAJOR_IDS.includes(p.id));

  // Fetch trending
  let trending: any[] = [];
  try {
    const trendingRes = await fetch('https://api.coingecko.com/api/v3/search/trending', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (trendingRes.ok) {
      const trendingData = await trendingRes.json();
      const trendingCoins = trendingData.coins || [];

      // Filter out majors and get first 5
      trending = trendingCoins
        .filter((t: any) => !MAJOR_IDS.includes(t.item?.id))
        .slice(0, 5)
        .map((t: any) => {
          const item = t.item;
          return {
            id: item.id,
            rank: item.market_cap_rank || 0,
            name: item.name,
            symbol: item.symbol?.toUpperCase() || '',
            image: item.small || item.thumb,
            priceUsd: toNumber(item.data?.price),
            changePercent24Hr: toNumber(item.data?.price_change_percentage_24h?.usd),
            marketCapUsd: toNumber(item.data?.market_cap),
            volumeUsd24Hr: toNumber(item.data?.total_volume),
          };
        });
    }
  } catch {
    // Fallback: use top movers from existing data (excluding majors)
    trending = others
      .sort((a, b) => Math.abs(b.changePercent24Hr) - Math.abs(a.changePercent24Hr))
      .slice(0, 5);
  }

  const totalMcap = allPrices.reduce((sum, p) => sum + p.marketCapUsd, 0);
  const totalVolume = allPrices.reduce((sum, p) => sum + p.volumeUsd24Hr, 0);
  const btcDominance = majors[0] ? (majors[0].marketCapUsd / totalMcap) * 100 : 0;
  const avgChange24h =
    allPrices.reduce((sum, p) => sum + p.changePercent24Hr, 0) / allPrices.length;

  return {
    majors,
    trending,
    prices: allPrices, // Keep for backward compatibility
    global: { totalMcap, totalVolume, btcDominance, avgChange24h },
  };
}

// CoinCap fallback (no rate limits)
async function fetchFromCoinCap() {
  const response = await fetch('https://api.coincap.io/v2/assets?limit=20', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`CoinCap API error: ${response.status}`);
  }

  const json = await response.json();
  const assets: any[] = json.data;

  const allPrices = assets.map((asset) => ({
    id: asset.id,
    rank: parseInt(asset.rank),
    name: asset.name,
    symbol: asset.symbol,
    image: null,
    priceUsd: parseFloat(asset.priceUsd),
    changePercent24Hr: parseFloat(asset.changePercent24Hr),
    marketCapUsd: parseFloat(asset.marketCapUsd),
    volumeUsd24Hr: parseFloat(asset.volumeUsd24Hr),
  }));

  const majors = allPrices.filter((p) => MAJOR_IDS.includes(p.id));
  const others = allPrices.filter((p) => !MAJOR_IDS.includes(p.id));

  // Trending fallback: top movers
  const trending = others
    .sort((a, b) => Math.abs(b.changePercent24Hr) - Math.abs(a.changePercent24Hr))
    .slice(0, 5);

  const totalMcap = allPrices.reduce((sum, p) => sum + p.marketCapUsd, 0);
  const totalVolume = allPrices.reduce((sum, p) => sum + p.volumeUsd24Hr, 0);
  const btcDominance = majors[0] ? (majors[0].marketCapUsd / totalMcap) * 100 : 0;
  const avgChange24h =
    allPrices.reduce((sum, p) => sum + p.changePercent24Hr, 0) / allPrices.length;

  return {
    majors,
    trending,
    prices: allPrices,
    global: { totalMcap, totalVolume, btcDominance, avgChange24h },
  };
}

export async function GET() {
  const now = Date.now();

  // Return cached data if fresh
  if (assetsCache && now - assetsCache.timestamp < CACHE_TTL) {
    return NextResponse.json(assetsCache.data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  }

  try {
    // Try CoinGecko first, fall back to CoinCap
    let result;
    try {
      result = await fetchFromCoinGecko();
    } catch {
      result = await fetchFromCoinCap();
    }

    const payload = { ...result, asOf: new Date(now).toISOString() };
    assetsCache = { data: payload, timestamp: now };

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    // Return stale cache if available
    if (assetsCache) {
      return NextResponse.json(assetsCache.data, {
        headers: { 'Cache-Control': 'public, s-maxage=30' },
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 502 }
    );
  }
}
