import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from './lib/prisma';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),
  });

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (_, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch {
      return reply.code(503).send({ status: 'error', db: 'down' });
    }
  });

  return app;
}
