import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CJK_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const CJK_REGEX_GLOBAL = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;
const THAI_REGEX_GLOBAL = /[\u0E00-\u0E7F]/g;
const WORD_CHAR_REGEX = /[A-Za-z0-9\u0E00-\u0E7F]/g;

const FALLBACK_TITLE_PREFIX = 'สรุปข่าว: ';
const FALLBACK_TITLE_DEFAULT = 'รายงานข่าวคริปโต';
const FALLBACK_SUMMARY =
  'เนื้อหาถูกทำความสะอาดภาษาอัตโนมัติ กรุณาอ่านบทความต้นฉบับเพื่อรายละเอียดเพิ่มเติม';

function stripCJK(text: string): string {
  return text
    .replace(CJK_REGEX_GLOBAL, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsCJK(text: string): boolean {
  return CJK_REGEX.test(text);
}

function hasSufficientThai(text: string, minThaiChars: number = 12, minThaiRatio: number = 0.12): boolean {
  const thaiChars = (text.match(THAI_REGEX_GLOBAL) || []).length;
  if (thaiChars < minThaiChars) return false;

  const wordChars = (text.match(WORD_CHAR_REGEX) || []).length;
  if (wordChars === 0) return false;

  return thaiChars / wordChars >= minThaiRatio;
}

function makeFallbackTitle(articleTitle: string): string {
  const clean = stripCJK(articleTitle);
  const suffix = clean.length > 0 ? clean.substring(0, 75) : FALLBACK_TITLE_DEFAULT;
  return `${FALLBACK_TITLE_PREFIX}${suffix}`.substring(0, 90);
}

type Candidate = {
  id: string;
  titleTh: string | null;
  summaryTh: string | null;
  article: { titleOriginal: string };
};

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const strictThai = args.has('--strict-thai');
  const batchSize = 500;

  console.log('\n=== Enrichment Language Cleanup ===');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Strict Thai check: ${strictThai ? 'ON' : 'OFF'}`);

  let cursor: string | undefined;
  let scanned = 0;
  let cjkRows = 0;
  let weakThaiRows = 0;
  let toUpdate = 0;
  let updated = 0;

  while (true) {
    const rows: Candidate[] = await prisma.enrichment.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        titleTh: true,
        summaryTh: true,
        article: {
          select: {
            titleOriginal: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    for (const row of rows) {
      const originalTitle = row.titleTh || '';
      const originalSummary = row.summaryTh || '';
      const hasCjk = containsCJK(originalTitle) || containsCJK(originalSummary);

      const cleanedTitle = stripCJK(originalTitle);
      const cleanedSummary = stripCJK(originalSummary);

      const weakThai = strictThai && cleanedSummary.length > 0 && !hasSufficientThai(cleanedSummary, 14, 0.1);

      if (hasCjk) cjkRows++;
      if (weakThai) weakThaiRows++;

      if (!hasCjk && !weakThai) {
        continue;
      }

      const nextTitle =
        cleanedTitle.length > 0 ? cleanedTitle.substring(0, 90) : makeFallbackTitle(row.article.titleOriginal);
      const nextSummary = cleanedSummary.length > 0 && !weakThai ? cleanedSummary : FALLBACK_SUMMARY;

      const titleChanged = (row.titleTh || '') !== nextTitle;
      const summaryChanged = (row.summaryTh || '') !== nextSummary;
      if (!titleChanged && !summaryChanged) {
        continue;
      }

      toUpdate++;

      if (apply) {
        await prisma.enrichment.update({
          where: { id: row.id },
          data: {
            titleTh: nextTitle,
            summaryTh: nextSummary,
          },
        });
        updated++;
      }
    }
  }

  console.log('\nCleanup report');
  console.log(`Scanned rows: ${scanned}`);
  console.log(`Rows with CJK detected: ${cjkRows}`);
  console.log(`Rows with weak Thai (strict mode): ${weakThaiRows}`);
  console.log(`Rows needing update: ${toUpdate}`);
  console.log(`Rows updated: ${updated}`);

  if (!apply) {
    console.log('\nNo changes written (dry-run).');
    console.log('Run with: npx tsx scripts/cleanup-enrichment-language.ts --apply');
  }
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
