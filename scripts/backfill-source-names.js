const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Map known domains to clean display names
const DOMAIN_TO_NAME = {
  'tradingview.com': 'TradingView',
  'finance.yahoo.com': 'Yahoo Finance',
  'cnbc.com': 'CNBC',
  'newsbtc.com': 'NewsBTC',
  'bitcoinist.com': 'Bitcoinist',
  'crypto.news': 'Crypto.news',
  'coingape.com': 'CoinGape',
  'ambcrypto.com': 'AMBCrypto',
  'beincrypto.com': 'BeInCrypto',
  'cryptobriefing.com': 'Crypto Briefing',
  'u.today': 'U.Today',
  'investors.com': 'Investors.com',
  'zycrypto.com': 'ZyCrypto',
  'cryptopotato.com': 'CryptoPotato',
  'thedefiant.io': 'The Defiant',
  'x.com': 'X (Twitter)',
  'stacker.news': 'Stacker News',
  'cointelegraph.com': 'CoinTelegraph',
  'coindesk.com': 'CoinDesk',
  'decrypt.co': 'Decrypt',
  'theblock.co': 'The Block',
  'blockworks.co': 'Blockworks',
  'bitcoinmagazine.com': 'Bitcoin Magazine',
  'cryptoslate.com': 'CryptoSlate',
};

function domainToName(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (DOMAIN_TO_NAME[host]) return DOMAIN_TO_NAME[host];
    // Fallback: capitalize domain parts
    const parts = host.split('.');
    const name = parts.slice(0, -1).join('.');
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return null;
  }
}

async function main() {
  const apiSource = await p.source.findFirst({ where: { type: 'API' } });
  if (!apiSource) { console.log('No API source found'); return; }

  const articles = await p.article.findMany({
    where: { sourceId: apiSource.id, originalSourceName: null },
    select: { id: true, url: true },
  });

  console.log(`Found ${articles.length} API articles with null originalSourceName`);

  let updated = 0;
  let skipped = 0;

  for (const article of articles) {
    const name = domainToName(article.url);
    if (name) {
      await p.article.update({
        where: { id: article.id },
        data: { originalSourceName: name },
      });
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`Done. Updated: ${updated}, Skipped: ${skipped}`);
  await p.$disconnect();
}

main();
