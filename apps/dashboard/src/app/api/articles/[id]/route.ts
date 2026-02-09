import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: {
      source: true,
      enrichment: true,
      postings: true,
    },
  });

  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  return NextResponse.json(article);
}
