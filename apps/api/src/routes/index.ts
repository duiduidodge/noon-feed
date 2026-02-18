import type { FastifyInstance } from 'fastify';
import { sourcesRoutes } from './sources.js';
import { articlesRoutes } from './articles.js';
import { ingestRoutes } from './ingest.js';
import { exportRoutes } from './export.js';
import { reliabilityRoutes } from './reliability.js';

export async function registerRoutes(fastify: FastifyInstance) {
  await fastify.register(sourcesRoutes, { prefix: '/sources' });
  await fastify.register(articlesRoutes, { prefix: '/articles' });
  await fastify.register(ingestRoutes, { prefix: '/ingest' });
  await fastify.register(exportRoutes, { prefix: '/export' });
  await fastify.register(reliabilityRoutes, { prefix: '/reliability' });
}
