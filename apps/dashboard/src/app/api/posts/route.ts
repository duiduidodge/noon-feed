import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const posts = await prisma.userPost.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { content, imageUrl, published } = body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  const post = await prisma.userPost.create({
    data: {
      content: content.trim(),
      imageUrl: imageUrl || null,
      published: published ?? true,
    },
  });

  return NextResponse.json(post, { status: 201 });
}
