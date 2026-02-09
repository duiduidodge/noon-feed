import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateSourceRequestSchema } from '@crypto-news/shared';

export async function sourcesRoutes(fastify: FastifyInstance) {
  // GET /sources - List all sources
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const sources = await fastify.prisma.source.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    return {
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        url: s.url,
        enabled: s.enabled,
        category: s.category,
        articleCount: s._count.articles,
        createdAt: s.createdAt,
      })),
    };
  });

  // GET /sources/:id - Get single source
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const source = await fastify.prisma.source.findUnique({
      where: { id },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    if (!source) {
      return reply.status(404).send({ error: 'Source not found' });
    }

    return {
      id: source.id,
      name: source.name,
      type: source.type,
      url: source.url,
      enabled: source.enabled,
      category: source.category,
      articleCount: source._count.articles,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  });

  // POST /sources - Create new source
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = CreateSourceRequestSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { name, type, url, enabled, category } = validation.data;

    // Check for duplicate URL
    const existing = await fastify.prisma.source.findUnique({
      where: { url },
    });

    if (existing) {
      return reply.status(409).send({ error: 'Source with this URL already exists' });
    }

    const source = await fastify.prisma.source.create({
      data: {
        name,
        type,
        url,
        enabled,
        category,
      },
    });

    return reply.status(201).send({
      id: source.id,
      name: source.name,
      type: source.type,
      url: source.url,
      enabled: source.enabled,
      category: source.category,
      createdAt: source.createdAt,
    });
  });

  // PATCH /sources/:id - Update source
  fastify.patch(
    '/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { name?: string; enabled?: boolean; category?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { name, enabled, category } = request.body as {
        name?: string;
        enabled?: boolean;
        category?: string;
      };

      const existing = await fastify.prisma.source.findUnique({
        where: { id },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Source not found' });
      }

      const updated = await fastify.prisma.source.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(enabled !== undefined && { enabled }),
          ...(category !== undefined && { category }),
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        url: updated.url,
        enabled: updated.enabled,
        category: updated.category,
        updatedAt: updated.updatedAt,
      };
    }
  );

  // DELETE /sources/:id - Delete source
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const existing = await fastify.prisma.source.findUnique({
      where: { id },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Source not found' });
    }

    await fastify.prisma.source.delete({
      where: { id },
    });

    return { success: true };
  });
}
