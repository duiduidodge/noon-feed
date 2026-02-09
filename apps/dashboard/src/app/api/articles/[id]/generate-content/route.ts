import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { extractJsonFromResponse, truncate } from '@crypto-news/shared';

const CONTENT_PROMPT = `Write a Thai social media post in article style (not a thread).
Rules: Thai only, accurate to the article, no speculation, 2-4 short paragraphs, <=1000 chars.

ARTICLE:
{ARTICLE_TEXT}

TITLE: {ARTICLE_TITLE}
SOURCE: {SOURCE_NAME}
PUBLISHED: {PUBLISHED_AT}

Return JSON only:
{
  "content_draft_th": "Thai article-style social post"
}`;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: {
      source: true,
      enrichment: true,
    },
  });

  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  if (!article.enrichment) {
    return NextResponse.json(
      { error: 'Article has not been enriched yet' },
      { status: 400 }
    );
  }

  if (!article.extractedText) {
    return NextResponse.json(
      { error: 'Article has no extracted text' },
      { status: 400 }
    );
  }

  const provider = process.env.LLM_PROVIDER || 'openrouter';
  const model =
    process.env.LLM_MODEL ||
    (provider === 'openai' ? 'gpt-4-turbo-preview' : 'x-ai/grok-4-fast');

  let apiKey = '';
  let baseURL: string | undefined;

  if (provider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY || '';
  } else if (provider === 'openrouter') {
    apiKey = process.env.OPENROUTER_API_KEY || '';
    baseURL = 'https://openrouter.ai/api/v1';
  } else {
    return NextResponse.json(
      { error: `Unsupported LLM provider for content generation: ${provider}` },
      { status: 400 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing LLM API key' },
      { status: 400 }
    );
  }

  const client = new OpenAI({ apiKey, baseURL });

  const truncatedText = truncate(article.extractedText, 4000);
  const prompt = CONTENT_PROMPT.replace('{ARTICLE_TEXT}', truncatedText)
    .replace('{ARTICLE_TITLE}', article.titleOriginal)
    .replace('{SOURCE_NAME}', article.source.name)
    .replace('{PUBLISHED_AT}', article.publishedAt?.toISOString() || 'Unknown');

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return NextResponse.json(
      { error: 'Empty response from LLM' },
      { status: 502 }
    );
  }

  let parsed: { content_draft_th?: string };
  try {
    parsed = extractJsonFromResponse(content) as { content_draft_th?: string };
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to parse LLM response' },
      { status: 502 }
    );
  }

  if (!parsed.content_draft_th) {
    return NextResponse.json(
      { error: 'Missing content_draft_th in response' },
      { status: 502 }
    );
  }

  await prisma.enrichment.update({
    where: { id: article.enrichment.id },
    data: { contentDraftTh: parsed.content_draft_th },
  });

  return NextResponse.json({ status: 'ok' });
}
