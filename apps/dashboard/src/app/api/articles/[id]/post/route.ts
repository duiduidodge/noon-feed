import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { enrichment: true },
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

  // Get channel from request body or use default
  let channelId = process.env.DISCORD_DEFAULT_CHANNEL_ID;

  try {
    const body = await request.json();
    if (body.channelId) {
      channelId = body.channelId;
    }
  } catch {
    // No body provided, use default
  }

  if (!channelId) {
    return NextResponse.json(
      { error: 'No channel ID provided and no default configured' },
      { status: 400 }
    );
  }

  // Create posting record
  const posting = await prisma.posting.create({
    data: {
      articleId: params.id,
      discordChannelId: channelId,
      status: 'PENDING',
    },
  });

  return NextResponse.json({
    id: posting.id,
    status: 'queued',
    message: 'Post queued. The bot will send it shortly.',
  });
}
