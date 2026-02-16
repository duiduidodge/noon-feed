import { PrismaClient } from '@prisma/client';
import { createLLMProvider } from '../services/llm-provider.js';
import { createLogger } from '@crypto-news/shared';

const logger = createLogger('worker:cli:translate-high-impact');
const prisma = new PrismaClient();

async function translateHighImpact() {
  logger.info('Starting HIGH impact translation run');

  // Find HIGH impact articles without Thai translation
  const articles = await prisma.article.findMany({
    where: {
      status: 'ENRICHED',
      enrichment: {
        marketImpact: 'HIGH',
        titleTh: null,
      },
    },
    include: {
      enrichment: true,
      source: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: 5, // Limit to 5 for testing
  });

  logger.info({ count: articles.length }, 'Found HIGH impact articles to translate');

  if (articles.length === 0) {
    logger.info('No articles to translate');
    return;
  }

  const llmProvider = createLLMProvider(
    'openrouter',
    process.env.OPENROUTER_API_KEY || '',
    'anthropic/claude-3.5-haiku' // Fast and cheap for translation
  );

  let translated = 0;

  for (const article of articles) {
    try {
      logger.info({ articleId: article.id, title: article.titleOriginal }, 'Translating article');

      const snippet = article.extractedText?.substring(0, 500) || '';
      
      const prompt = `Translate the following crypto news to Thai. Provide ONLY the translation, no explanations.

Title: ${article.titleOriginal}
Preview: ${snippet}

Provide:
1. Thai title (one line)
2. Thai summary (2-3 sentences)

Format your response as:
TITLE: [Thai title here]
SUMMARY: [Thai summary here]`;

      const content = await llmProvider.complete(prompt, {
        temperature: 0.3,
        maxTokens: 500,
      });
      
      // Parse response
      const titleMatch = content.match(/TITLE:\s*(.+?)(?:\n|$)/);
      const summaryMatch = content.match(/SUMMARY:\s*(.+?)(?:\n\n|$)/s);

      const titleTh = titleMatch?.[1]?.trim() || article.titleOriginal;
      const summaryTh = summaryMatch?.[1]?.trim() || snippet;

      // Update enrichment with Thai translation
      await prisma.enrichment.update({
        where: { articleId: article.id },
        data: {
          titleTh,
          summaryTh,
        },
      });

      logger.info({ articleId: article.id, titleTh }, 'Translation completed');
      translated++;

      // Rate limiting: 2 seconds between translations
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      logger.error({ 
        articleId: article.id, 
        error: (error as Error).message 
      }, 'Failed to translate article');
    }
  }

  logger.info({ translated }, 'Translation run complete');
  await prisma.$disconnect();
}

translateHighImpact().catch((error) => {
  logger.error({ error: error.message }, 'Translation run failed');
  process.exit(1);
});
