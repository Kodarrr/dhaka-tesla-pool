import os
import re

base_dir = "/home/hamim/projects/dhaka-tesla-pool/apps/api"

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

# 1. schema.prisma
schema = """enum Role {
  PASSENGER
  DRIVER
}

enum Stage {
  REQUESTED
  MATCHED
  DRIVER_ARRIVED
  COMPLETED
  CANCELLED
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String        @id @default(uuid())
  name         String
  email        String        @unique
  passwordHash String
  role         Role
  createdAt    DateTime      @default(now())

  tesla           Tesla?
  rideRequests    RideRequest[]
  reviewsGiven    Review[] @relation("PassengerReviews")
  reviewsReceived Review[] @relation("DriverReviews")
}

model Tesla {
  id        String   @id @default(uuid())
  driverId  String   @unique
  driver    User     @relation(fields: [driverId], references: [id])
  name      String
  plate     String   @unique
  capacity  Int
  isOnline  Boolean  @default(false)
  createdAt DateTime @default(now())

  pools Pool[]
}

// One Pool = one Tesla trip. It may start with no teslaId (open,
// waiting for a driver to accept) and gains one on MATCHED.
model Pool {
  id          String   @id @default(uuid())
  teslaId     String?
  tesla       Tesla?   @relation(fields: [teslaId], references: [id])
  corridorId  String?
  pickupZone  String
  stage       Stage    @default(REQUESTED)
  // Private pools (shareable=false) are never returned by available-shares.
  shareable   Boolean  @default(false)
  seatsCap    Int
  seatsTaken  Int      @default(0)
  createdAt   DateTime @default(now())
  matchedAt   DateTime?
  arrivedAt   DateTime?
  completedAt DateTime?

  rideRequests RideRequest[]

  @@index([stage])
  @@index([corridorId])
  @@index([shareable, stage, pickupZone])
}

model RideRequest {
  id              String    @id @default(uuid())
  passengerId     String
  passenger       User      @relation(fields: [passengerId], references: [id])
  poolId          String?
  pool            Pool?     @relation(fields: [poolId], references: [id])
  corridorId      String?
  pickupZone      String
  destinationZone String
  seats           Int
  openToShare     Boolean   @default(false)
  maxShareSeats   Int       @default(0)
  stage           Stage     @default(REQUESTED)

  // Fare stored in integer paisa (1 taka = 100 paisa) to avoid float rounding
  baseFarePaisa       Int
  distanceChargePaisa Int
  poolDiscountPaisa   Int      @default(0)
  totalFarePaisa      Int
  fareBreakdown       Json?

  createdAt   DateTime  @default(now())
  cancelledAt DateTime?

  review Review?

  @@index([passengerId])
  @@index([poolId])
}

model Review {
  id            String      @id @default(uuid())
  rideRequestId String      @unique
  rideRequest   RideRequest @relation(fields: [rideRequestId], references: [id])
  passengerId   String
  passenger     User        @relation("PassengerReviews", fields: [passengerId], references: [id])
  driverId      String
  driver        User        @relation("DriverReviews", fields: [driverId], references: [id])
  rating        Int         // 1-5, enforced at the API layer
  comment       String?
  createdAt     DateTime    @default(now())

  @@index([driverId])
}
"""
write_file(f"{base_dir}/prisma/schema.prisma", schema)

# 2. driver.service.ts
driver_service = """import { prisma } from '../../lib/prisma.js';

export class DriverError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export async function acceptPool(driverId: string, poolId: string) {
  const tesla = await prisma.tesla.findUnique({ where: { driverId } });
  if (!tesla) throw new DriverError(403, 'No Tesla registered for this driver');

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) throw new DriverError(404, 'Pool not found');
  if (pool.stage !== 'REQUESTED') throw new DriverError(409, 'Pool is not in REQUESTED state');

  return prisma.pool.update({
    where: { id: poolId },
    data: { stage: 'MATCHED', teslaId: tesla.id, matchedAt: new Date() },
    include: {
      rideRequests: { include: { passenger: { select: { id: true, name: true } } } },
      tesla: true,
    },
  });
}

export async function markArrived(driverId: string, poolId: string) {
  const tesla = await prisma.tesla.findUnique({ where: { driverId } });
  if (!tesla) throw new DriverError(403, 'No Tesla registered for this driver');

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) throw new DriverError(404, 'Pool not found');
  if (pool.teslaId !== tesla.id)
    throw new DriverError(403, 'This pool is not assigned to your Tesla');
  if (pool.stage !== 'MATCHED')
    throw new DriverError(409, 'Pool must be MATCHED before marking arrived');

  // Update pool + all active ride requests atomically
  const [updatedPool] = await prisma.$transaction([
    prisma.pool.update({
      where: { id: poolId },
      data: { stage: 'DRIVER_ARRIVED', arrivedAt: new Date() },
      include: {
        rideRequests: { include: { passenger: { select: { id: true, name: true } } } },
        tesla: true,
      },
    }),
    prisma.rideRequest.updateMany({
      where: { poolId, stage: { in: ['REQUESTED', 'MATCHED'] } },
      data: { stage: 'DRIVER_ARRIVED' },
    }),
  ]);
  return updatedPool;
}

export async function completeTrip(driverId: string, poolId: string) {
  const tesla = await prisma.tesla.findUnique({ where: { driverId } });
  if (!tesla) throw new DriverError(403, 'No Tesla registered for this driver');

  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) throw new DriverError(404, 'Pool not found');
  if (pool.teslaId !== tesla.id)
    throw new DriverError(403, 'This pool is not assigned to your Tesla');
  if (pool.stage !== 'DRIVER_ARRIVED')
    throw new DriverError(409, 'Pool must be DRIVER_ARRIVED before completing');

  const [updatedPool] = await prisma.$transaction([
    prisma.pool.update({
      where: { id: poolId },
      data: { stage: 'COMPLETED', completedAt: new Date() },
      include: {
        rideRequests: { include: { passenger: { select: { id: true, name: true } } } },
        tesla: true,
      },
    }),
    prisma.rideRequest.updateMany({
      where: { poolId, stage: 'DRIVER_ARRIVED' },
      data: { stage: 'COMPLETED' },
    }),
  ]);
  return updatedPool;
}
"""
write_file(f"{base_dir}/src/modules/driver/driver.service.ts", driver_service)

# 3. driver.routes.ts
driver_routes = """import { FastifyInstance } from 'fastify';
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
"""
write_file(f"{base_dir}/src/modules/driver/driver.routes.ts", driver_routes)

# 4. users.routes.ts
users_routes = """import { FastifyInstance } from 'fastify';
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
"""
write_file(f"{base_dir}/src/modules/users/users.routes.ts", users_routes)

# 5. Review endpoint in rides.routes.ts
rides_routes_path = f"{base_dir}/src/modules/rides/rides.routes.ts"
rr_content = read_file(rides_routes_path)
if "import { prisma }" not in rr_content:
    import_idx = rr_content.find(";")
    if import_idx != -1:
        rr_content = rr_content[:import_idx+1] + "\nimport { prisma } from '../../lib/prisma.js';" + rr_content[import_idx+1:]
    else:
        rr_content = "import { prisma } from '../../lib/prisma.js';\n" + rr_content

review_route = """
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
"""

# Find the last closing brace and insert the review route before it
last_brace_idx = rr_content.rfind("}")
if last_brace_idx != -1:
    rr_content = rr_content[:last_brace_idx] + review_route + rr_content[last_brace_idx:]
write_file(rides_routes_path, rr_content)

# 6. rides.service.ts
rides_service_path = f"{base_dir}/src/modules/rides/rides.service.ts"
rs_content = read_file(rides_service_path)
rs_content = rs_content.replace(
    "['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED']",
    "['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED']"
)

old_update = """    await tx.pool.update({
      where: { id: poolId },
      data: {
        seatsTaken: locked.seatsTaken + seats,
        ...(commonCorridor ? { corridorId: commonCorridor.id } : {}),
      },
    });"""

new_update = """    // BUGFIX NOTE (Change 3): joinPool must NEVER modify Pool.teslaId, Pool.stage,
    // or any other driver-assignment fields. Touching teslaId or resetting stage to
    // REQUESTED would cause a MATCHED pool to reappear in the driver's open-pools feed,
    // requiring the driver to re-accept what they already accepted. Only seatsTaken
    // (and optionally corridorId when a common corridor is found) may be updated here.
    await tx.pool.update({
      where: { id: poolId },
      data: {
        seatsTaken: locked.seatsTaken + seats,
        ...(commonCorridor ? { corridorId: commonCorridor.id } : {}),
      },
    });"""

if old_update in rs_content:
    rs_content = rs_content.replace(old_update, new_update)
else:
    print("WARNING: Could not find exact pool.update block to replace in rides.service.ts")
    # Let's try a regex or looser match just in case, or we will check manually
write_file(rides_service_path, rs_content)

# 7. share-discovery.ts
sd_path = f"{base_dir}/src/modules/rides/share-discovery.ts"
sd_content = read_file(sd_path)
sd_content = sd_content.replace(
    "export const SHARE_JOINABLE_STAGES = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'] as const;",
    "export const SHARE_JOINABLE_STAGES = ['REQUESTED', 'MATCHED'] as const;"
)
write_file(sd_path, sd_content)

# 8. teslas.routes.ts fix (if empty)
teslas_path = f"{base_dir}/src/modules/teslas/teslas.routes.ts"
try:
    if os.path.getsize(teslas_path) == 0:
        write_file(teslas_path, "import { FastifyInstance } from 'fastify';\\n\\nexport default async function teslasRoutes(fastify: FastifyInstance) {}\\n")
except FileNotFoundError:
    pass

# 9. app.ts
app_ts = """import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from './lib/prisma.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './modules/auth/auth.routes.js';
import rideRoutes from './modules/rides/rides.routes.js';
import driverRoutes from './modules/driver/driver.routes.js';
import userRoutes from './modules/users/users.routes.js';
import teslasRoutes from './modules/teslas/teslas.routes.js';

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
"""
write_file(f"{base_dir}/src/app.ts", app_ts)
