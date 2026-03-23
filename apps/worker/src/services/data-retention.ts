import type { PrismaClient } from '@prisma/client';

export interface RetentionCleanupResult {
  deletedArticles: number;
  deletedHeartbeats: number;
  deletedEmergingAlerts: number;
  deletedEmergingSnapshots: number;
  deletedWhaleSnapshots: number;
  deletedMarketSummaries: number;
  deletedJobAudits: number;
}

export interface RetentionCleanupOptions {
  articleRetentionDays: number;
  heartbeatRetentionDays: number;
  emergingRetentionDays: number;
  whaleRetentionDays: number;
  marketSummaryRetentionDays: number;
  jobAuditRetentionDays: number;
}

export async function runRetentionCleanup(
  prisma: PrismaClient,
  options: RetentionCleanupOptions
): Promise<RetentionCleanupResult> {
  const now = Date.now();
  const articleCutoff = new Date(now - options.articleRetentionDays * 24 * 60 * 60 * 1000);
  const heartbeatCutoff = new Date(now - options.heartbeatRetentionDays * 24 * 60 * 60 * 1000);
  const emergingCutoff = new Date(now - options.emergingRetentionDays * 24 * 60 * 60 * 1000);
  const whaleCutoff = new Date(now - options.whaleRetentionDays * 24 * 60 * 60 * 1000);
  const marketSummaryCutoff = new Date(
    now - options.marketSummaryRetentionDays * 24 * 60 * 60 * 1000
  );
  const jobAuditCutoff = new Date(now - options.jobAuditRetentionDays * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const deletedArticles = (
      await tx.article.deleteMany({
        where: {
          createdAt: { lt: articleCutoff },
        },
      })
    ).count;

    const deletedHeartbeats = (
      await tx.botHeartbeat.deleteMany({
        where: {
          observedAt: { lt: heartbeatCutoff },
        },
      })
    ).count;

    const deletedEmergingAlerts = (
      await tx.emergingMoverAlert.deleteMany({
        where: {
          createdAt: { lt: emergingCutoff },
        },
      })
    ).count;

    const deletedEmergingSnapshots = (
      await tx.emergingMoverSnapshot.deleteMany({
        where: {
          createdAt: { lt: emergingCutoff },
        },
      })
    ).count;

    const deletedWhaleSnapshots = (
      await tx.whaleSnapshot.deleteMany({
        where: {
          createdAt: { lt: whaleCutoff },
        },
      })
    ).count;

    const deletedMarketSummaries = (
      await tx.marketSummary.deleteMany({
        where: {
          createdAt: { lt: marketSummaryCutoff },
        },
      })
    ).count;

    const deletedJobAudits = (
      await tx.jobAudit.deleteMany({
        where: {
          createdAt: { lt: jobAuditCutoff },
        },
      })
    ).count;

    return {
      deletedArticles,
      deletedHeartbeats,
      deletedEmergingAlerts,
      deletedEmergingSnapshots,
      deletedWhaleSnapshots,
      deletedMarketSummaries,
      deletedJobAudits,
    };
  });

  return result;
}
