import { FastifyInstance } from 'fastify';
import { acceptPool, markArrived, completeTrip, DriverError } from './driver.service.js';

export default async function driverRoutes(fastify: FastifyInstance) {
  const requireDriver = [fastify.authenticate, fastify.requireRole('DRIVER')];

  fastify.post('/:poolId/accept', { preHandler: requireDriver }, async (req, reply) => {
    const { poolId } = req.params as { poolId: string };
    try {
      const pool = await acceptPool(req.user.sub, poolId);
      return reply.code(200).send(pool);
    } catch (err) {
      if (err instanceof DriverError)
        return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  fastify.post('/:poolId/arrived', { preHandler: requireDriver }, async (req, reply) => {
    const { poolId } = req.params as { poolId: string };
    try {
      const pool = await markArrived(req.user.sub, poolId);
      return reply.code(200).send(pool);
    } catch (err) {
      if (err instanceof DriverError)
        return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  fastify.post('/:poolId/complete', { preHandler: requireDriver }, async (req, reply) => {
    const { poolId } = req.params as { poolId: string };
    try {
      const pool = await completeTrip(req.user.sub, poolId);
      return reply.code(200).send(pool);
    } catch (err) {
      if (err instanceof DriverError)
        return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
