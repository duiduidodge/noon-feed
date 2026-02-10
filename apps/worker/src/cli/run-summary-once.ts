import { PrismaClient } from '@prisma/client';
import type { LLMProviderInterface } from '@crypto-news/shared';
import { buildConfig, createLogger } from '@crypto-news/shared';
import { createLLMProvider } from '../services/llm-provider.js';
import { processGenerateSummaryJob } from '../jobs/generate-summary.js';

const logger = createLogger('worker:cli:summary-once');
const config = buildConfig();
const prisma = new PrismaClient();

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const SUMMARY_WINDOW_MS = 12 * 60 * 60 * 1000;

type ScheduleType = 'morning' | 'evening';

function resolveScheduleType(): ScheduleType {
  const arg = process.argv.find((v) => v.startsWith('--type='))?.split('=')[1];
  const envType = (process.env.SUMMARY_TYPE || '').toLowerCase();
  const raw = (arg || envType || 'auto').toLowerCase();

  if (raw === 'morning' || raw === 'evening') return raw;

  const now = new Date();
  const bangkokHour = (now.getUTCHours() + 7) % 24;
  return bangkokHour >= 7 && bangkokHour < 19 ? 'morning' : 'evening';
}

function getSlotStartUtc(nowUtc: Date, scheduleType: ScheduleType): Date {
  const nowBangkokProxy = new Date(nowUtc.getTime() + BANGKOK_OFFSET_MS);
  const targetHour = scheduleType === 'morning' ? 7 : 19;

  const todaySlotBangkokProxy = new Date(
    Date.UTC(
      nowBangkokProxy.getUTCFullYear(),
      nowBangkokProxy.getUTCMonth(),
      nowBangkokProxy.getUTCDate(),
      targetHour,
      0,
      0
    )
  );

  if (todaySlotBangkokProxy.getTime() <= nowBangkokProxy.getTime()) {
    return new Date(todaySlotBangkokProxy.getTime() - BANGKOK_OFFSET_MS);
  }

  const previousDaySlotBangkokProxy = new Date(todaySlotBangkokProxy.getTime() - 24 * 60 * 60 * 1000);
  return new Date(previousDaySlotBangkokProxy.getTime() - BANGKOK_OFFSET_MS);
}

function getLlmApiKey(): string {
  if (config.llm.provider === 'openai') {
    if (!config.llm.openaiApiKey) throw new Error('Missing OPENAI_API_KEY for provider=openai');
    return config.llm.openaiApiKey;
  }
  if (config.llm.provider === 'anthropic') {
    if (!config.llm.anthropicApiKey) throw new Error('Missing ANTHROPIC_API_KEY for provider=anthropic');
    return config.llm.anthropicApiKey;
  }
  if (config.llm.provider === 'openrouter') {
    if (!config.llm.openrouterApiKey) throw new Error('Missing OPENROUTER_API_KEY for provider=openrouter');
    return config.llm.openrouterApiKey;
  }
  throw new Error(`Unknown LLM provider: ${config.llm.provider}`);
}

function createFallbackLlmProvider(reason: string): LLMProviderInterface {
  return {
    name: config.llm.provider,
    async complete() {
      throw new Error(`LLM unavailable: ${reason}`);
    },
  };
}

function buildLlmProvider(): LLMProviderInterface {
  try {
    const llmApiKey = getLlmApiKey();
    return createLLMProvider(config.llm.provider, llmApiKey, config.llm.model);
  } catch (error) {
    const reason = (error as Error).message;
    logger.warn({ reason }, 'LLM unavailable, summary will use fallback text');
    return createFallbackLlmProvider(reason);
  }
}

async function main() {
  const scheduleType = resolveScheduleType();
  const now = new Date();
  const slotStartUtc = getSlotStartUtc(now, scheduleType);
  const slotEndUtc = new Date(slotStartUtc.getTime() + SUMMARY_WINDOW_MS);

  logger.info({ scheduleType, slotStartUtc: slotStartUtc.toISOString() }, 'Starting one-shot summary run');

  const existing = await prisma.marketSummary.findFirst({
    where: {
      scheduleType,
      createdAt: {
        gte: slotStartUtc,
        lt: slotEndUtc,
      },
    },
    select: { id: true, createdAt: true },
  });

  if (existing) {
    logger.info(
      { summaryId: existing.id, createdAt: existing.createdAt.toISOString(), scheduleType },
      'Summary already exists for this slot; skipping'
    );
    return;
  }

  const llmProvider = buildLlmProvider();
  const result = await processGenerateSummaryJob(
    {
      scheduleType,
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    },
    prisma,
    llmProvider
  );

  logger.info({ result, scheduleType }, 'One-shot summary run complete');
}

main()
  .catch((error) => {
    logger.error({ error: (error as Error).message }, 'One-shot summary run failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
