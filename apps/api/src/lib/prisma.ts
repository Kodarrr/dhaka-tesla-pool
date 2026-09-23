import { PrismaClient } from '@prisma/client';

// Single shared instance — avoids exhausting Postgres connections
// under Fastify's hot-reload in dev.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});
