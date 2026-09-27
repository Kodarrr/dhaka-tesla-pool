import { FastifyInstance } from 'fastify';
import {
  acceptPool,
  markArrived,
  arriveTrip,
  completeTrip,
  getDriverHistory,
  confirmCashPayment,
  getDriverTesla,
  setDriverOnlineStatus,
  DriverError,
} from './driver.service.js';

export default async function driverRoutes(fastify: FastifyInstance) {
  const requireDriver = [fastify.authenticate, fastify.requireRole('DRIVER')];

  fastify.get('/status', { preHandler: requireDriver }, async (req, reply) => {
    try {
      const tesla = await getDriverTesla(req.user.sub);
      return reply.code(200).send({ success: true, tesla, isOnline: tesla.isOnline });
    } catch (err) {
      if (err instanceof DriverError)
        return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  fastify.patch('/status', { preHandler: requireDriver }, async (req, reply) => {
    const body = req.body as { isOnline?: boolean } | undefined;
    try {
      const tesla = await setDriverOnlineStatus(req.user.sub, body?.isOnline);
      return reply.code(200).send({ success: true, tesla, isOnline: tesla.isOnline });
    } catch (err) {
      if (err instanceof DriverError)
        return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  fastify.post('/toggle-online', { preHandler: requireDriver }, async (req, reply) => {
    const body = req.body as { isOnline?: boolean } | undefined;
    try {
      const tesla = await setDriverOnlineStatus(req.user.sub, body?.isOnline);
      return reply.code(200).send({ success: true, tesla, isOnline: tesla.isOnline });
    } catch (err) {
      if (err instanceof DriverError)
        return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  fastify.get('/history', { preHandler: requireDriver }, async (req, reply) => {
    try {
      const history = await getDriverHistory(req.user.sub);
      return reply.code(200).send(history);
    } catch (err) {
      if (err instanceof DriverError)
        return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

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

  fastify.patch('/:poolId/arrive', { preHandler: requireDriver }, async (req, reply) => {
    const { poolId } = req.params as { poolId: string };
    try {
      const pool = await arriveTrip(req.user.sub, poolId);
      return reply.code(200).send({ success: true, pool });
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

  fastify.patch('/:poolId/complete', { preHandler: requireDriver }, async (req, reply) => {
    const { poolId } = req.params as { poolId: string };
    try {
      const pool = await completeTrip(req.user.sub, poolId);
      return reply.code(200).send({ success: true, pool });
    } catch (err) {
      if (err instanceof DriverError)
        return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  fastify.post('/rides/:rideId/confirm-cash', { preHandler: requireDriver }, async (req, reply) => {
    const { rideId } = req.params as { rideId: string };
    try {
      const ride = await confirmCashPayment(req.user.sub, rideId);
      return reply.code(200).send({ success: true, ride });
    } catch (err) {
      if (err instanceof DriverError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
