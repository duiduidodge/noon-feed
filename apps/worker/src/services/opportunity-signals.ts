import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { Prisma, type PrismaClient } from '@prisma/client';
import { createLogger } from '@crypto-news/shared';

const logger = createLogger('worker:signals:opportunities');
const exec = promisify(execCb);

interface RawOpportunity {
  asset?: string;
  direction?: string;
  leverage?: number;
  finalScore?: number;
  scoreDelta?: number;
  scanStreak?: number;
  hourlyTrend?: string;
  trendAligned?: boolean;
  pillarScores?: unknown;
  smartMoney?: unknown;
  technicals?: unknown;
  funding?: unknown;
  risks?: unknown;
}

interface RawOpportunityPayload {
  scanTime?: string;
  assetsScanned?: number;
  passedStage1?: number;
  passedStage2?: number;
  deepDived?: number;
  disqualified?: number;
  btcContext?: unknown;
  opportunities?: RawOpportunity[];
}

function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in command output');
  }
  return text.slice(start, end + 1);
}

function toNullableJsonInput(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export class OpportunitySignalsService {
  private readonly enabled: boolean;
  private readonly command?: string;

  constructor(opts: { enabled: boolean; command?: string }) {
    this.enabled = opts.enabled;
    this.command = opts.command?.trim();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async pollAndPersist(prisma: PrismaClient): Promise<void> {
    if (!this.enabled) return;

    if (!this.command) {
      logger.warn('ENABLE_OPPORTUNITY_SIGNALS=true but OPPORTUNITY_SIGNALS_COMMAND is empty');
      return;
    }

    const startedAt = Date.now();

    const { stdout, stderr } = await exec(this.command, {
      timeout: 90_000,
      maxBuffer: 3 * 1024 * 1024,
      shell: '/bin/bash',
      env: process.env,
    });

    const combinedOutput = `${stdout || ''}\n${stderr || ''}`.trim();
    if (!combinedOutput) {
      throw new Error('Opportunity scanner command returned empty output');
    }

    const payload = JSON.parse(extractJsonObject(combinedOutput)) as RawOpportunityPayload;
    const scanTime = payload.scanTime ? new Date(payload.scanTime) : new Date();

    if (Number.isNaN(scanTime.getTime())) {
      throw new Error(`Invalid scan timestamp: ${payload.scanTime}`);
    }

    const opportunities = Array.isArray(payload.opportunities)
      ? payload.opportunities.filter((item) => typeof item.asset === 'string' && item.asset.trim() !== '')
      : [];

    await prisma.$transaction(async (tx) => {
      const snapshot = await tx.opportunitySnapshot.create({
        data: {
          scanTime,
          assetsScanned: payload.assetsScanned ?? null,
          passedStage1: payload.passedStage1 ?? null,
          passedStage2: payload.passedStage2 ?? null,
          deepDived: payload.deepDived ?? null,
          disqualified: payload.disqualified ?? 0,
          btcContext: toNullableJsonInput(payload.btcContext),
          rawPayload: payload as Prisma.InputJsonValue,
        },
      });

      if (opportunities.length > 0) {
        await tx.opportunitySignal.createMany({
          data: opportunities.map((item) => ({
            snapshotId: snapshot.id,
            asset: item.asset || 'UNKNOWN',
            direction: item.direction ?? null,
            leverage: item.leverage ?? null,
            finalScore: item.finalScore ?? null,
            scoreDelta: item.scoreDelta ?? null,
            scanStreak: item.scanStreak ?? null,
            hourlyTrend: item.hourlyTrend ?? null,
            trendAligned: Boolean(item.trendAligned),
            pillarScores: toNullableJsonInput(item.pillarScores),
            smartMoney: toNullableJsonInput(item.smartMoney),
            technicals: toNullableJsonInput(item.technicals),
            funding: toNullableJsonInput(item.funding),
            risks: toNullableJsonInput(item.risks),
          })),
        });
      }

      const staleSnapshots = await tx.opportunitySnapshot.findMany({
        orderBy: { createdAt: 'desc' },
        skip: 200,
        select: { id: true },
      });

      if (staleSnapshots.length > 0) {
        await tx.opportunitySnapshot.deleteMany({
          where: { id: { in: staleSnapshots.map((row) => row.id) } },
        });
      }
    });

    logger.info(
      {
        opportunities: opportunities.length,
        elapsedMs: Date.now() - startedAt,
      },
      'Stored opportunity snapshot'
    );
  }
}
