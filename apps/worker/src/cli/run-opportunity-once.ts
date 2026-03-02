/**
 * One-shot CLI: runs the opportunity scanner once and persists to DB.
 * Usage: tsx src/cli/run-opportunity-once.ts
 */
import { PrismaClient } from '@prisma/client';
import { buildConfig } from '@crypto-news/shared';
import { OpportunitySignalsService } from '../services/opportunity-signals.js';

const prisma = new PrismaClient();
const config = buildConfig();

async function main() {
  const service = new OpportunitySignalsService({
    enabled: config.worker.enableOpportunitySignals,
  });

  if (!service.isEnabled()) {
    console.error('ENABLE_OPPORTUNITY_SIGNALS is not true in .env — nothing to do.');
    process.exit(1);
  }

  console.log('Running opportunity scanner...');
  await service.pollAndPersist(prisma);
  console.log('Done — snapshot saved to DB.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
