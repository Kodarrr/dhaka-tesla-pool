import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';

export interface JwtPayload {
  sub: string; // user id
  role: 'PASSENGER' | 'DRIVER';
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (role: JwtPayload['role']) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// This is the augmentation @fastify/jwt actually expects — it types
// both the signed payload and req.user from this one interface.
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export default fp(async (fastify) => {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET is required'); })(),
  });

  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'unauthorized', message: 'Invalid or missing token' });
    }
  });

  // Usage: { preHandler: [fastify.authenticate, fastify.requireRole('DRIVER')] }
  fastify.decorate('requireRole', (role) => async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user.role !== role) {
      reply.code(403).send({ error: 'forbidden', message: `Requires ${role} role` });
    }
  });
});
