import { prisma } from '@/lib/prisma';
import { StatCard } from '@/components/stat-card';
import { clusterDuplicateStories } from '@crypto-news/shared';
import { AlertTriangle, BellRing, CheckCircle2, Clock, Layers3 } from 'lucide-react';

export const dynamic = 'force-dynamic';

function ageHours(date: Date | null): number | null {
  if (!date) return null;
  return Math.round(((Date.now() - date.getTime()) / (60 * 60 * 1000)) * 10) / 10;
}

async function getReliabilityData() {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const staleThresholdHours = Number(process.env.RELIABILITY_STALE_SOURCE_HOURS || 12);
  const staleCutoff = new Date(now.getTime() - staleThresholdHours * 60 * 60 * 1000);

  const [
    pendingArticles,
    failedArticles,
    pendingPosts,
    posted24h,
    failedPosts24h,
    recentFailedJobs,
    sources,
    latestMorning,
    latestEvening,
    recentArticles,
  ] = await Promise.all([
    prisma.article.count({ where: { status: 'PENDING' } }),
    prisma.article.count({ where: { status: 'FAILED' } }),
    prisma.posting.count({ where: { status: 'PENDING' } }),
    prisma.posting.count({ where: { status: 'POSTED', createdAt: { gte: last24h } } }),
    prisma.posting.count({ where: { status: 'FAILED', createdAt: { gte: last24h } } }),
    prisma.jobAudit.findMany({
      where: { status: 'FAILED', createdAt: { gte: last24h } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, jobType: true, error: true, createdAt: true },
    }),
    prisma.source.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        articles: {
          select: { publishedAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.marketSummary.findFirst({ where: { scheduleType: 'morning' }, orderBy: { createdAt: 'desc' } }),
    prisma.marketSummary.findFirst({ where: { scheduleType: 'evening' }, orderBy: { createdAt: 'desc' } }),
    prisma.article.findMany({
      where: { status: { in: ['FETCHED', 'ENRICHED'] }, publishedAt: { gte: last24h } },
      select: {
        id: true,
        titleOriginal: true,
        url: true,
        urlNormalized: true,
        publishedAt: true,
        source: { select: { name: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 400,
    }),
  ]);

  const staleSources = sources
    .map((source) => {
      const latest = source.articles[0];
      const lastSeen = latest?.publishedAt || latest?.createdAt || null;
      return {
        id: source.id,
        name: source.name,
        lastSeen,
        ageHours: ageHours(lastSeen),
      };
    })
    .filter((source) => !source.lastSeen || source.lastSeen < staleCutoff)
    .sort((a, b) => (b.ageHours || 0) - (a.ageHours || 0));

  const duplicateClusters = clusterDuplicateStories(
    recentArticles.map((article) => ({
      id: article.id,
      titleOriginal: article.titleOriginal,
      url: article.url,
      urlNormalized: article.urlNormalized,
      publishedAt: article.publishedAt,
      sourceName: article.source.name,
    })),
    { minClusterSize: 2, maxAgeHours: 24 }
  );

  const postAttempts = posted24h + failedPosts24h;
  const successRate = postAttempts > 0 ? Math.round((posted24h / postAttempts) * 100) : 100;

  return {
    pendingArticles,
    failedArticles,
    pendingPosts,
    posted24h,
    failedPosts24h,
    successRate,
    recentFailedJobs,
    staleSources,
    staleThresholdHours,
    latestMorning,
    latestEvening,
    duplicateClusters,
  };
}

export default async function ReliabilityPage() {
  const data = await getReliabilityData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reliability Console</h1>
        <p className="text-muted-foreground">
          Monitor queue health, stale sources, posting reliability, and duplicate-story pressure.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Pending Articles"
          value={data.pendingArticles}
          icon={Clock}
          description="Waiting for fetch"
          className={data.pendingArticles > 50 ? 'text-orange-600' : undefined}
        />
        <StatCard
          title="Failed Articles"
          value={data.failedArticles}
          icon={AlertTriangle}
          description="Need investigation"
          className={data.failedArticles > 0 ? 'text-red-600' : undefined}
        />
        <StatCard
          title="Posting Success 24h"
          value={`${data.successRate}%`}
          icon={CheckCircle2}
          description={`${data.posted24h} posted / ${data.failedPosts24h} failed`}
          className={data.successRate < 95 ? 'text-orange-600' : 'text-green-600'}
        />
        <StatCard
          title="Duplicate Clusters 24h"
          value={data.duplicateClusters.length}
          icon={Layers3}
          description="Cross-source duplicate events"
          className={data.duplicateClusters.length > 8 ? 'text-orange-600' : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">Summary Delivery Health</h2>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="font-medium">Morning Summary</div>
              <div className="text-muted-foreground">
                {data.latestMorning
                  ? `${data.latestMorning.createdAt.toISOString()} • ${ageHours(data.latestMorning.createdAt)}h ago`
                  : 'No summary found'}
              </div>
              {data.latestMorning?.error && <div className="mt-1 text-red-600">Error: {data.latestMorning.error}</div>}
            </div>
            <div className="rounded-md border p-3">
              <div className="font-medium">Evening Summary</div>
              <div className="text-muted-foreground">
                {data.latestEvening
                  ? `${data.latestEvening.createdAt.toISOString()} • ${ageHours(data.latestEvening.createdAt)}h ago`
                  : 'No summary found'}
              </div>
              {data.latestEvening?.error && <div className="mt-1 text-red-600">Error: {data.latestEvening.error}</div>}
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">Stale Sources</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Sources with no new article in the last {data.staleThresholdHours} hours.
          </p>
          <div className="space-y-2 text-sm">
            {data.staleSources.length === 0 && <div className="text-green-600">No stale sources.</div>}
            {data.staleSources.slice(0, 10).map((source) => (
              <div key={source.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span>{source.name}</span>
                <span className="text-muted-foreground">{source.ageHours ?? 'n/a'}h</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">Recent Failed Jobs (24h)</h2>
        <div className="space-y-2 text-sm">
          {data.recentFailedJobs.length === 0 && <div className="text-green-600">No failed jobs in last 24h.</div>}
          {data.recentFailedJobs.map((job) => (
            <div key={job.id} className="rounded-md border px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{job.jobType}</span>
                <span className="text-xs text-muted-foreground">{job.createdAt.toISOString()}</span>
              </div>
              <div className="mt-1 text-xs text-red-600">{job.error || 'Unknown error'}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <BellRing className="h-5 w-5" />
          Duplicate Story Clusters (24h)
        </h2>
        <div className="space-y-3 text-sm">
          {data.duplicateClusters.length === 0 && <div className="text-green-600">No significant duplicate clusters.</div>}
          {data.duplicateClusters.slice(0, 8).map((cluster) => (
            <div key={cluster.clusterId} className="rounded-md border p-3">
              <div className="font-medium">{cluster.representativeTitle}</div>
              <div className="text-xs text-muted-foreground">
                {cluster.size} related articles • signals: {cluster.matchSignals.join(', ') || 'n/a'}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
