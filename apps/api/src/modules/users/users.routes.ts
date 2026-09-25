import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/:id/profile',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          role: true,
          createdAt: true,
          tesla: {
            select: { id: true, name: true, plate: true, capacity: true },
          },
        },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const base = {
        id: user.id,
        name: user.name,
        role: user.role,
        memberSince: user.createdAt,
      };

      if (user.role === 'DRIVER') {
        const [reviewAgg, completedPools] = await Promise.all([
          prisma.review.aggregate({
            where: { driverId: id },
            _avg: { rating: true },
            _count: { rating: true },
          }),
          user.tesla
            ? prisma.pool.count({
                where: { teslaId: user.tesla.id, stage: 'COMPLETED' },
              })
            : Promise.resolve(0),
        ]);

        return reply.code(200).send({
          ...base,
          tesla: user.tesla,
          averageRating:
            reviewAgg._avg.rating != null
              ? Math.round(reviewAgg._avg.rating * 10) / 10
              : null,
          reviewCount: reviewAgg._count.rating,
          totalCompletedRides: completedPools,
        });
      }

      // PASSENGER
      const totalRidesTaken = await prisma.rideRequest.count({
        where: { passengerId: id, stage: 'COMPLETED' },
      });

      return reply.code(200).send({ ...base, totalRidesTaken });
    }
  );
}
