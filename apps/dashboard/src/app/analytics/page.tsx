import { prisma } from '@/lib/prisma';
import { StatCard } from '@/components/stat-card';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getAnalytics(rangeDays: number) {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rangeStart = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);

  const [
    totalArticles,
    articlesThisWeek,
    articlesThisMonth,
    bySource,
    byTag,
    bySentiment,
    byMarketImpact,
    postsThisWeek,
  ] = await Promise.all([
    prisma.article.count({ where: { status: 'ENRICHED' } }),
    prisma.article.count({
      where: { status: 'ENRICHED', createdAt: { gte: weekStart } },
    }),
    prisma.article.count({
      where: { status: 'ENRICHED', createdAt: { gte: rangeStart } },
    }),
    prisma.article.groupBy({
      by: ['sourceId'],
      where: { status: 'ENRICHED' },
      _count: { id: true },
    }),
    prisma.enrichment.findMany({
      select: { tags: true },
    }),
    prisma.enrichment.groupBy({
      by: ['sentiment'],
      _count: { id: true },
    }),
    prisma.enrichment.groupBy({
      by: ['marketImpact'],
      _count: { id: true },
    }),
    prisma.posting.count({
      where: { status: 'POSTED', createdAt: { gte: weekStart } },
    }),
  ]);

  // Get source names
  const sources = await prisma.source.findMany({
    select: { id: true, name: true },
  });
  const sourceMap = new Map(sources.map((s) => [s.id, s.name]));

  // Count tags
  const tagCounts: Record<string, number> = {};
  byTag.forEach((e) => {
    const tags = e.tags as string[];
    tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  return {
    totalArticles,
    articlesThisWeek,
    articlesThisMonth,
    postsThisWeek,
    bySource: bySource
      .map((s) => ({
        sourceId: s.sourceId,
        sourceName: sourceMap.get(s.sourceId) || 'Unknown',
        count: s._count.id,
      }))
      .sort((a, b) => b.count - a.count),
    byTag: Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    bySentiment: bySentiment.map((s) => ({
      sentiment: s.sentiment,
      count: s._count.id,
    })),
    byMarketImpact: byMarketImpact.map((s) => ({
      impact: s.marketImpact,
      count: s._count.id,
    })),
  };
}

interface AnalyticsPageProps {
  searchParams: {
    range?: string;
  };
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const selectedRange = [7, 30, 90].includes(parseInt(searchParams.range || '30', 10))
    ? parseInt(searchParams.range || '30', 10)
    : 30;
  const analytics = await getAnalytics(selectedRange);

  const sentimentTotal = analytics.bySentiment.reduce((sum, s) => sum + s.count, 0);
  const bullishPercent = Math.round(
    sentimentTotal === 0
      ? 0
      : ((analytics.bySentiment.find((s) => s.sentiment === 'BULLISH')?.count || 0) /
          sentimentTotal) *
          100
  );
  const bearishPercent = Math.round(
    sentimentTotal === 0
      ? 0
      : ((analytics.bySentiment.find((s) => s.sentiment === 'BEARISH')?.count || 0) /
          sentimentTotal) *
          100
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Insights and statistics about your crypto news content
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Charts summarize the last {selectedRange} days of enriched content.
        </p>
        <div className="mt-3 flex gap-2">
          {[7, 30, 90].map((range) => (
            <a
              key={range}
              href={`/analytics?range=${range}`}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                selectedRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-accent'
              }`}
            >
              {range}d
            </a>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Articles"
          value={analytics.totalArticles}
          icon={BarChart3}
          description="All enriched articles"
        />
        <StatCard
          title="This Week"
          value={analytics.articlesThisWeek}
          icon={TrendingUp}
          description="New articles this week"
          className="text-green-600"
        />
        <StatCard
          title="This Month"
          value={analytics.articlesThisMonth}
          icon={TrendingUp}
          description="New articles this month"
          className="text-blue-600"
        />
        <StatCard
          title="Posts This Week"
          value={analytics.postsThisWeek}
          icon={TrendingUp}
          description="Discord posts"
          className="text-purple-600"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sentiment Distribution */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Sentiment Distribution</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Colors: green = bullish, red = bearish, gray = neutral.
          </p>
          <div className="space-y-4">
            {analytics.bySentiment.map((item) => {
              const percent = Math.round((item.count / sentimentTotal) * 100);
              const colors: Record<string, string> = {
                BULLISH: 'bg-green-500',
                BEARISH: 'bg-red-500',
                NEUTRAL: 'bg-gray-400',
              };
              return (
                <div key={item.sentiment}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {item.sentiment === 'BULLISH' && <TrendingUp className="h-4 w-4 text-green-600" />}
                      {item.sentiment === 'BEARISH' && <TrendingDown className="h-4 w-4 text-red-600" />}
                      {item.sentiment === 'NEUTRAL' && <Minus className="h-4 w-4 text-gray-400" />}
                      {item.sentiment}
                    </span>
                    <span className="text-muted-foreground">
                      {item.count} ({percent}%)
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted">
                    <div
                      className={`h-3 rounded-full ${colors[item.sentiment]}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Market Impact Distribution */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Market Impact Distribution</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Colors: orange = high, yellow = medium, blue = low.
          </p>
          <div className="space-y-4">
            {analytics.byMarketImpact.map((item) => {
              const total = analytics.byMarketImpact.reduce((sum, i) => sum + i.count, 0);
              const percent = Math.round((item.count / total) * 100);
              const colors: Record<string, string> = {
                HIGH: 'bg-orange-500',
                MEDIUM: 'bg-yellow-500',
                LOW: 'bg-blue-400',
              };
              return (
                <div key={item.impact}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{item.impact}</span>
                    <span className="text-muted-foreground">
                      {item.count} ({percent}%)
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted">
                    <div
                      className={`h-3 rounded-full ${colors[item.impact]}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Sources */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Top Sources</h2>
          <div className="space-y-3">
            {analytics.bySource.slice(0, 10).map((item, index) => (
              <div key={item.sourceId} className="flex items-center justify-between">
                <span className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {index + 1}
                  </span>
                  {item.sourceName}
                </span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Tags */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Top Tags</h2>
          <div className="flex flex-wrap gap-2">
            {analytics.byTag.map((item) => (
              <span
                key={item.tag}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground"
              >
                #{item.tag}
                <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-xs">
                  {item.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
