import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import { createLogger, buildConfig } from '@crypto-news/shared';

import { registerRoutes } from './routes/index.js';

const logger = createLogger('api');
const config = buildConfig();
const prisma = new PrismaClient();

async function main() {
  const fastify = Fastify({
    logger: {
      level: config.logging.level,
    },
  });

  // Register plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Decorate fastify with prisma
  fastify.decorate('prisma', prisma);
  fastify.decorate('config', config);

  // Register routes
  await registerRoutes(fastify);

  // Health check
  fastify.get('/health', async () => {
    const dbHealthy = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbHealthy ? 'connected' : 'disconnected',
    };
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await fastify.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start server
  try {
    await fastify.listen({
      port: config.api.port,
      host: config.api.host,
    });
    logger.info(`API server running on http://${config.api.host}:${config.api.port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

main();

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    config: ReturnType<typeof buildConfig>;
  }
}
