import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();

  const source = await prisma.source.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      ...(body.category !== undefined && { category: body.category }),
    },
  });

  return NextResponse.json(source);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  await prisma.source.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
