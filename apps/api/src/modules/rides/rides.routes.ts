import { FastifyInstance } from 'fastify';
import { estimateRideSchema, requestRideSchema } from './rides.schema.js';
import {
  estimateRide,
  requestRide,
  getMyRides,
  getActiveRides,
  RideError,
} from './rides.service.js';

export default async function rideRoutes(fastify: FastifyInstance) {
  // 1. POST /api/v1/rides/estimate
  fastify.post('/estimate', async (req, reply) => {
    const parsed = estimateRideSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_request',
        details: parsed.error.flatten(),
      });
    }

    try {
      const estimate = await estimateRide(parsed.data);
      return reply.code(200).send(estimate);
    } catch (err) {
      if (err instanceof RideError) {
        return reply.code(err.statusCode).send({ error: 'ride_error', message: err.message });
      }
      throw err;
    }
  });

  // 2. POST /api/v1/rides/request
  fastify.post(
    '/request',
    { preHandler: [fastify.authenticate, fastify.requireRole('PASSENGER')] },
    async (req, reply) => {
      const parsed = requestRideSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_request',
          details: parsed.error.flatten(),
        });
      }

      try {
        const passengerId = req.user.sub;
        const ride = await requestRide(passengerId, parsed.data);
        return reply.code(201).send(ride);
      } catch (err) {
        if (err instanceof RideError) {
          return reply.code(err.statusCode).send({ error: 'ride_error', message: err.message });
        }
        throw err;
      }
    }
  );

  // 3. GET /api/v1/rides/my-rides
  fastify.get(
    '/my-rides',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      try {
        const passengerId = req.user.sub;
        const rides = await getMyRides(passengerId);
        return reply.code(200).send({ rides });
      } catch (err) {
        if (err instanceof RideError) {
          return reply.code(err.statusCode).send({ error: 'ride_error', message: err.message });
        }
        throw err;
      }
    }
  );

  // 4. GET /api/v1/rides/active
  fastify.get(
    '/active',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      try {
        const activeData = await getActiveRides();
        return reply.code(200).send(activeData);
      } catch (err) {
        if (err instanceof RideError) {
          return reply.code(err.statusCode).send({ error: 'ride_error', message: err.message });
        }
        throw err;
      }
    }
  );
}