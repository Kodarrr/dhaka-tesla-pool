import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from './lib/prisma';
import authPlugin from './plugins/auth.js';
import authRoutes from './modules/auth/auth.routes.js';

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV === 'production'
      ? true
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        },
    });

  app.register(cors, {
    origin: (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),
  });

  app.register(authPlugin);
  app.register(authRoutes);

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
