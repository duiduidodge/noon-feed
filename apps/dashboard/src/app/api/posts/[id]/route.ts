import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const post = await prisma.userPost.findUnique({
    where: { id: params.id },
  });

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  return NextResponse.json(post);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();

  const post = await prisma.userPost.update({
    where: { id: params.id },
    data: {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
      ...(body.published !== undefined && { published: body.published }),
    },
  });

  return NextResponse.json(post);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  await prisma.userPost.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
