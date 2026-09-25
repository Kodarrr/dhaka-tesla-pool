import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import {
  estimateRideSchema,
  requestRideSchema,
  availableSharesQuerySchema,
  joinPoolSchema,
  shareableQuerySchema,
} from './rides.schema.js';
import {
  estimateRide,
  requestRide,
  cancelRide,
  getMyRides,
  getActiveRides,
  listAvailableShares,
  listShareableRides,
  joinPool,
  RideError,
} from './rides.service.js';

export default async function rideRoutes(fastify: FastifyInstance) {
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

  fastify.get(
    '/available-shares',
    { preHandler: [fastify.authenticate, fastify.requireRole('PASSENGER')] },
    async (req, reply) => {
      const parsed = availableSharesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_request',
          details: parsed.error.flatten(),
        });
      }

      try {
        const result = await listAvailableShares(req.user.sub, parsed.data);
        return reply.code(200).send(result);
      } catch (err) {
        if (err instanceof RideError) {
          return reply.code(err.statusCode).send({ error: 'ride_error', message: err.message });
        }
        throw err;
      }
    }
  );

  fastify.post(
    '/:poolId/join',
    { preHandler: [fastify.authenticate, fastify.requireRole('PASSENGER')] },
    async (req, reply) => {
      const parsed = joinPoolSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_request',
          details: parsed.error.flatten(),
        });
      }

      const { poolId } = req.params as { poolId: string };
      try {
        const ride = await joinPool(req.user.sub, poolId, parsed.data);
        return reply.code(201).send(ride);
      } catch (err) {
        if (err instanceof RideError) {
          return reply.code(err.statusCode).send({ error: 'ride_error', message: err.message });
        }
        throw err;
      }
    }
  );

  fastify.post(
    '/:id/cancel',
    { preHandler: [fastify.authenticate, fastify.requireRole('PASSENGER')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        const passengerId = req.user.sub;
        const ride = await cancelRide(passengerId, id);
        return reply.code(200).send({ success: true, ride });
      } catch (err) {
        if (err instanceof RideError) {
          return reply.code(err.statusCode).send({ error: 'ride_error', message: err.message });
        }
        throw err;
      }
    }
  );

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


  fastify.get(
    '/shareable',
    { preHandler: [fastify.authenticate, fastify.requireRole('PASSENGER')] },
    async (req, reply) => {
      const parsed = shareableQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_request',
          details: parsed.error.flatten(),
        });
      }

      try {
        const result = await listShareableRides(parsed.data.search);
        return reply.code(200).send({ rides: result });
      } catch (err) {
        if (err instanceof RideError) {
          return reply.code(err.statusCode).send({ error: 'ride_error', message: err.message });
        }
        throw err;
      }
    }
  );

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

  fastify.post(
    '/:id/review',
    { preHandler: [fastify.authenticate, fastify.requireRole('PASSENGER')] },
    async (req, reply) => {
      const { id: rideRequestId } = req.params as { id: string };
      const body = req.body as { rating?: unknown; comment?: unknown };

      const rating = Number(body?.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return reply.code(400).send({
          error: 'invalid_request',
          message: 'rating must be an integer 1–5',
        });
      }
      const comment =
        typeof body?.comment === 'string' ? body.comment.slice(0, 300) : undefined;

      try {
        const passengerId = req.user.sub;

        // Load ride with pool+tesla to derive driverId server-side (never trust client)
        const ride = await prisma.rideRequest.findUnique({
          where: { id: rideRequestId },
          include: { pool: { include: { tesla: true } } },
        });

        if (!ride) return reply.code(404).send({ error: 'Ride not found' });
        if (ride.passengerId !== passengerId)
          return reply.code(403).send({ error: 'Forbidden' });
        if (ride.stage !== 'COMPLETED')
          return reply.code(400).send({ error: 'Can only review a completed ride' });
        if (!ride.pool?.tesla)
          return reply.code(400).send({ error: 'No driver assigned to this ride' });

        const driverId = ride.pool.tesla.driverId;

        const review = await prisma.review.create({
          data: { rideRequestId, passengerId, driverId, rating, comment },
        });

        return reply.code(201).send(review);
      } catch (err: unknown) {
        const pe = err as { code?: string };
        if (pe?.code === 'P2002') {
          return reply
            .code(409)
            .send({ error: 'You have already reviewed this ride' });
        }
        throw err;
      }
    }
  );
}
