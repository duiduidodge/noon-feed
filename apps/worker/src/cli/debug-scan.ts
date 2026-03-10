/**
 * Debug: runs one scan with production gates + debug logging.
 */
import { buildConfig } from '@crypto-news/shared';
buildConfig();

process.env.OPPORTUNITY_DEBUG_GATES = 'true';

import { runOpportunityScan } from '../services/opportunity-scanner.js';

async function main() {
  const result = await runOpportunityScan();
  console.log('\n=== SCAN RESULTS ===');
  console.log('Stage1:', result.passedStage1, '| Stage2:', result.passedStage2, '| Deep:', result.deepDived, '| Filtered:', result.filteredByGates);
  console.log('BTC:', result.btcContext.trend, '4H:', result.btcContext.trend4h, '$' + result.btcContext.price);
  console.log('Qualified:', result.opportunities.length);
  for (const o of result.opportunities) {
    console.log(`  ${o.asset} ${o.direction} score:${o.finalScore.toFixed(0)} streak:${o.scanStreak} tier:${o.convictionTier} regime:${o.regime} adx:${o.technicals.adx4h.toFixed(0)} rsi1h:${o.technicals.rsi1h.toFixed(0)} vol:${o.technicals.volRatio1h.toFixed(1)} ema:${o.technicals.emaBounce.confluence}/${o.technicals.emaBounce.required} swing:${o.swingGrade} risks:[${o.risks.join(',')}]`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
