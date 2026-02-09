import { prisma } from '@/lib/prisma';
import { StatCard } from '@/components/stat-card';
import { RecentArticles } from '@/components/recent-articles';
import { Newspaper, CheckCircle, Send, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getStats() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalArticles,
    enrichedArticles,
    pendingArticles,
    failedArticles,
    postedToday,
    postedWeek,
  ] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: 'ENRICHED' } }),
    prisma.article.count({ where: { status: 'PENDING' } }),
    prisma.article.count({ where: { status: 'FAILED' } }),
    prisma.posting.count({
      where: { postedAt: { gte: todayStart }, status: 'POSTED' },
    }),
    prisma.posting.count({
      where: { postedAt: { gte: weekStart }, status: 'POSTED' },
    }),
  ]);

  return {
    totalArticles,
    enrichedArticles,
    pendingArticles,
    failedArticles,
    postedToday,
    postedWeek,
  };
}

async function getRecentArticles() {
  const articles = await prisma.article.findMany({
    where: { status: 'ENRICHED' },
    select: {
      id: true,
      titleOriginal: true,
      publishedAt: true,
      url: true,
      originalSourceName: true,
      source: { select: { name: true } },
      enrichment: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: 10,
  });

  return articles;
}

export default async function DashboardPage() {
  const stats = await getStats();
  const recentArticles = await getRecentArticles();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your crypto news content pipeline
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Articles"
          value={stats.totalArticles}
          icon={Newspaper}
          description="All fetched articles"
        />
        <StatCard
          title="Enriched"
          value={stats.enrichedArticles}
          icon={CheckCircle}
          description="Processed with AI"
          className="text-green-600"
        />
        <StatCard
          title="Posted Today"
          value={stats.postedToday}
          icon={Send}
          description="Shared to Discord"
          className="text-blue-600"
        />
        <StatCard
          title="Pending/Failed"
          value={`${stats.pendingArticles}/${stats.failedArticles}`}
          icon={AlertTriangle}
          description="Needs attention"
          className="text-orange-600"
        />
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Recent Articles</h2>
        <RecentArticles articles={recentArticles} />
      </div>
    </div>
  );
}
