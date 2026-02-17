/**
 * Manual 12-hour backfill script
 * Fetches from API (cryptocurrency.cv) + RSS (Blockworks, CryptoSlate)
 */
import { PrismaClient } from '@prisma/client';
import { normalizeUrl, createArticleHash, isDuplicateArticle, isNoiseTitle, isBlockedSource } from '@crypto-news/shared';
import { EnrichmentMapper } from '../apps/worker/src/services/enrichment-mapper.js';

const prisma = new PrismaClient();
const TWELVE_HOURS_AGO = new Date(Date.now() - 12 * 60 * 60 * 1000);
const USER_AGENT = 'CryptoNewsBot/1.0';

async function fetchAPIPage(page: number, limit: number): Promise<any[]> {
  const params = new URLSearchParams({ limit: String(limit), page: String(page) });
  const res = await fetch(`https://cryptocurrency.cv/api/news?${params.toString()}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const data = (await res.json()) as any;
  return data.articles || [];
}

async function main() {
  console.log(`Backfilling articles since ${TWELVE_HOURS_AGO.toISOString()}\n`);

  // Load recent articles for dedup
  const recentArticles = await prisma.article.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    select: { urlNormalized: true, titleOriginal: true, hash: true },
  });
  console.log(`Loaded ${recentArticles.length} recent articles for dedup\n`);

  const apiSource = await prisma.source.findFirst({ where: { type: 'API', enabled: true } });
  if (!apiSource) {
    console.log('No API source found!');
    return;
  }

  let totalNew = 0, totalDupes = 0, totalSkipped = 0, totalErrors = 0;

  // ── API fetch ──────────────────────────────────────────────
  console.log('=== API: cryptocurrency.cv ===');
  for (let page = 1; page <= 15; page++) {
    const articles = await fetchAPIPage(page, 50);
    if (articles.length === 0) break;

    let pageNew = 0, tooOld = 0;
    for (const item of articles) {
      const pubDate = new Date(item.pubDate || item.publishedAt);
      if (pubDate < TWELVE_HOURS_AGO) { tooOld++; continue; }

      const source = item.source || '';
      const url = item.link || item.url || '';

      if (isBlockedSource(source, url)) { totalSkipped++; continue; }

      const noiseReason = isNoiseTitle(item.title);
      if (noiseReason) { totalSkipped++; continue; }

      const normalizedUrl = normalizeUrl(url);
      const hash = createArticleHash(item.title, url, pubDate);

      if (recentArticles.find((a) => a.hash === hash)) { totalDupes++; continue; }
      if (recentArticles.find((a) => a.urlNormalized === normalizedUrl)) { totalDupes++; continue; }
      if (recentArticles.find((a) =>
        isDuplicateArticle(
          { titleOriginal: a.titleOriginal, urlNormalized: a.urlNormalized },
          { title: item.title, url },
        ),
      )) { totalDupes++; continue; }

      try {
        const enrichment = EnrichmentMapper.mapEnrichment(
          { externalSentiment: item.sentiment, externalCategory: item.category },
          item.title,
        );
        await prisma.article.create({
          data: {
            sourceId: apiSource.id,
            originalSourceName: source,
            url,
            urlNormalized: normalizedUrl,
            titleOriginal: item.title,
            publishedAt: pubDate,
            hash,
            extractedText: item.description || '',
            status: 'ENRICHED',
            language: 'en',
            impactScore: enrichment.marketImpact === 'HIGH' ? 0.9 : enrichment.marketImpact === 'MEDIUM' ? 0.5 : 0.1,
            preFilterPassed: true,
            enrichment: {
              create: {
                ...enrichment,
                titleTh: null,
                summaryTh: null,
                takeawaysTh: [],
                hooksTh: [],
                threadTh: [],
                contentDraftTh: null,
                llmModel: 'API_SOURCE',
                llmProvider: 'API_SOURCE',
              },
            },
          },
        });
        recentArticles.push({ urlNormalized: normalizedUrl, titleOriginal: item.title, hash });
        pageNew++;
        totalNew++;
      } catch (e: any) {
        if (e.code === 'P2002') { totalDupes++; } else { totalErrors++; console.error(`  Error: ${e.message}`); }
      }
    }
    console.log(`  Page ${page}: ${articles.length} fetched, ${pageNew} new, ${tooOld} too old`);
    if (tooOld > articles.length / 2) {
      console.log('  Most articles older than 12h, stopping pagination');
      break;
    }
  }

  // ── RSS feeds (Blockworks + CryptoSlate) ───────────────────
  console.log('\n=== RSS Feeds ===');
  const rssFeeds = await prisma.source.findMany({ where: { type: 'RSS', enabled: true } });

  for (const feed of rssFeeds) {
    console.log(`  Fetching: ${feed.name} (${feed.url})`);
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
      });
      const xml = await res.text();

      // Parse RSS items
      const items: { title: string; link: string; pubDate?: string }[] = [];
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        const content = match[1];
        const title = content.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] || '';
        const link =
          content.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/)?.[1] ||
          content.match(/<link[^>]*href=["']([^"']+)/)?.[1] ||
          '';
        const pubDate = content.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
        if (title && link) items.push({ title: title.trim(), link: link.trim(), pubDate });
      }

      let feedNew = 0;
      for (const item of items) {
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        if (pubDate < TWELVE_HOURS_AGO) continue;

        const noiseReason = isNoiseTitle(item.title);
        if (noiseReason) { totalSkipped++; continue; }

        const normalizedUrl = normalizeUrl(item.link);
        const hash = createArticleHash(item.title, item.link, pubDate);

        if (recentArticles.find((a) => a.hash === hash || a.urlNormalized === normalizedUrl)) { totalDupes++; continue; }
        if (recentArticles.find((a) =>
          isDuplicateArticle(
            { titleOriginal: a.titleOriginal, urlNormalized: a.urlNormalized },
            { title: item.title, url: item.link },
          ),
        )) { totalDupes++; continue; }

        try {
          await prisma.article.create({
            data: {
              sourceId: feed.id,
              originalSourceName: feed.name,
              url: item.link,
              urlNormalized: normalizedUrl,
              titleOriginal: item.title,
              publishedAt: pubDate,
              hash,
              status: 'FETCHED',
            },
          });
          recentArticles.push({ urlNormalized: normalizedUrl, titleOriginal: item.title, hash });
          feedNew++;
          totalNew++;
        } catch (e: any) {
          if (e.code === 'P2002') { totalDupes++; } else { totalErrors++; }
        }
      }
      console.log(`    ${items.length} items in feed, ${feedNew} new (within 12h)`);
    } catch (e: any) {
      console.error(`    Failed: ${e.message}`);
      totalErrors++;
    }
  }

  // ── Summary ────────────────────────────────────────────────
  console.log('\n========== SUMMARY ==========');
  console.log(`  New articles:  ${totalNew}`);
  console.log(`  Duplicates:    ${totalDupes}`);
  console.log(`  Skipped:       ${totalSkipped}`);
  console.log(`  Errors:        ${totalErrors}`);

  // Show breakdown by source
  const newBySource = await prisma.article.groupBy({
    by: ['originalSourceName'],
    where: { createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } }, // last 5 min
    _count: true,
    orderBy: { _count: { originalSourceName: 'desc' } },
  });
  if (newBySource.length > 0) {
    console.log('\n  New articles by source:');
    for (const row of newBySource) {
      console.log(`    ${String(row._count).padStart(4)} | ${row.originalSourceName || '(unknown)'}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
