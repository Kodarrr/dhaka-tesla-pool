import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from './lib/prisma.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './modules/auth/auth.routes.js';
import rideRoutes from './modules/rides/rides.routes.js';
import driverRoutes from './modules/driver/driver.routes.js';
import userRoutes from './modules/users/users.routes.js';
import teslasRoutes from './modules/teslas/teslas.routes.js';
import walletRoutes from './modules/wallet/wallet.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';

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
  app.register(rideRoutes, { prefix: '/api/v1/rides' });
  app.register(driverRoutes, { prefix: '/api/v1/driver' });
  app.register(userRoutes, { prefix: '/api/v1/users' });
  app.register(teslasRoutes, { prefix: '/api/v1/teslas' });
  app.register(walletRoutes, { prefix: '/api/v1/wallet' });
  app.register(notificationRoutes, { prefix: '/api/v1/notifications' });

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
