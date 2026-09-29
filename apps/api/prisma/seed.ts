import {PrismaClient} from '@prisma/client'
import bcrypt from 'bcrypt';


const prisma= new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const jashim = await prisma.user.upsert({
    where: { email: 'jashim@gmail.com' },
    update: {},
    create: { name: 'Jashim', email: 'jashim@gmail.com', passwordHash, role: 'DRIVER' },
  });

  const bullet = await prisma.tesla.upsert({
    where: { driverId: jashim.id },
    update: { isOnline: true },
    create: { driverId: jashim.id, name: 'Bullet', plate: 'DHA-3021', capacity: 3, isOnline: true },
  });

  const nusrat = await prisma.user.upsert({
    where: { email: 'nusrat@gmail.com' },
    update: {},
    create: { name: 'Nusrat', email: 'nusrat@gmail.com', passwordHash, role: 'PASSENGER' },
  });

  const rafiq = await prisma.user.upsert({
    where: { email: 'rafiq@gmail.com' },
    update: {},
    create: { name: 'Rafiq', email: 'rafiq@gmail.com', passwordHash, role: 'PASSENGER' },
  });

  const shirin = await prisma.user.upsert({
    where: { email: 'shirin@gmail.com' },
    update: {},
    create: { name: 'Shirin', email: 'shirin@gmail.com', passwordHash, role: 'PASSENGER' },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: { role: 'ADMIN' },
    create: { name: 'System Admin', email: 'admin@gmail.com', passwordHash, role: 'ADMIN' },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'traffic_jam' },
    update: {},
    create: { key: 'traffic_jam', value: 'false' },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'raining' },
    update: {},
    create: { key: 'raining', value: 'false' },
  });

  // ── Seed Active Test Pools for Tree Matching & Pooling ───────────────────
  // Pool 1: Banani -> Mohakhali (Nusrat - Airport Road corridor, Matched with Bullet)
  const pool1 = await prisma.pool.upsert({
    where: { id: 'd7a00001-0000-4000-8000-000000000001' },
    update: {
      teslaId: bullet.id,
      stage: 'MATCHED',
      seatsCap: 3,
      seatsTaken: 1,
      shareable: true,
      pickupZone: 'BANANI',
      currentLocation: 'BANANI',
      corridorId: 'CORRIDOR_AIRPORT_ROAD',
    },
    create: {
      id: 'd7a00001-0000-4000-8000-000000000001',
      teslaId: bullet.id,
      stage: 'MATCHED',
      seatsCap: 3,
      seatsTaken: 1,
      shareable: true,
      pickupZone: 'BANANI',
      currentLocation: 'BANANI',
      corridorId: 'CORRIDOR_AIRPORT_ROAD',
      matchedAt: new Date(),
    },
  });

  await prisma.rideRequest.upsert({
    where: { id: 'e8a00001-0000-4000-8000-000000000001' },
    update: {
      poolId: pool1.id,
      stage: 'MATCHED',
      seats: 1,
      pickupZone: 'BANANI',
      destinationZone: 'MOHAKHALI',
      openToShare: true,
      maxShareSeats: 2,
    },
    create: {
      id: 'e8a00001-0000-4000-8000-000000000001',
      passengerId: nusrat.id,
      poolId: pool1.id,
      pickupZone: 'BANANI',
      destinationZone: 'MOHAKHALI',
      seats: 1,
      stage: 'MATCHED',
      baseFarePaisa: 10000,
      distanceChargePaisa: 10000,
      poolDiscountPaisa: 3000,
      totalFarePaisa: 17000,
      openToShare: true,
      maxShareSeats: 2,
      paymentMethod: 'TESLAPAY',
      paymentStatus: 'UNPAID',
      corridorId: 'CORRIDOR_AIRPORT_ROAD',
      matchedAt: new Date(),
    },
  });

  // Pool 2: Uttara -> Motijheel (Rafiq - North-South Arterial corridor, Matched with Bullet)
  const pool2 = await prisma.pool.upsert({
    where: { id: 'd7a00002-0000-4000-8000-000000000002' },
    update: {
      teslaId: bullet.id,
      stage: 'MATCHED',
      seatsCap: 3,
      seatsTaken: 1,
      shareable: true,
      pickupZone: 'UTTARA',
      currentLocation: 'UTTARA',
      corridorId: 'CORRIDOR_NORTH_SOUTH',
    },
    create: {
      id: 'd7a00002-0000-4000-8000-000000000002',
      teslaId: bullet.id,
      stage: 'MATCHED',
      seatsCap: 3,
      seatsTaken: 1,
      shareable: true,
      pickupZone: 'UTTARA',
      currentLocation: 'UTTARA',
      corridorId: 'CORRIDOR_NORTH_SOUTH',
      matchedAt: new Date(),
    },
  });

  await prisma.rideRequest.upsert({
    where: { id: 'e8a00002-0000-4000-8000-000000000002' },
    update: {
      poolId: pool2.id,
      stage: 'MATCHED',
      seats: 1,
      pickupZone: 'UTTARA',
      destinationZone: 'MOTIJHEEL',
      openToShare: true,
      maxShareSeats: 2,
    },
    create: {
      id: 'e8a00002-0000-4000-8000-000000000002',
      passengerId: rafiq.id,
      poolId: pool2.id,
      pickupZone: 'UTTARA',
      destinationZone: 'MOTIJHEEL',
      seats: 1,
      stage: 'MATCHED',
      baseFarePaisa: 10000,
      distanceChargePaisa: 100000,
      poolDiscountPaisa: 30000,
      totalFarePaisa: 80000,
      openToShare: true,
      maxShareSeats: 2,
      paymentMethod: 'TESLAPAY',
      paymentStatus: 'UNPAID',
      corridorId: 'CORRIDOR_NORTH_SOUTH',
      matchedAt: new Date(),
    },
  });

  // Pool 3: Gulshan -> Dhanmondi (Shirin - East-West connector tree branch, Requested)
  const pool3 = await prisma.pool.upsert({
    where: { id: 'd7a00003-0000-4000-8000-000000000003' },
    update: {
      stage: 'REQUESTED',
      seatsCap: 3,
      seatsTaken: 1,
      shareable: true,
      pickupZone: 'GULSHAN',
      currentLocation: 'GULSHAN',
      corridorId: 'CORRIDOR_WEST_EAST_REV',
    },
    create: {
      id: 'd7a00003-0000-4000-8000-000000000003',
      stage: 'REQUESTED',
      seatsCap: 3,
      seatsTaken: 1,
      shareable: true,
      pickupZone: 'GULSHAN',
      currentLocation: 'GULSHAN',
      corridorId: 'CORRIDOR_WEST_EAST_REV',
    },
  });

  await prisma.rideRequest.upsert({
    where: { id: 'e8a00003-0000-4000-8000-000000000003' },
    update: {
      poolId: pool3.id,
      stage: 'REQUESTED',
      seats: 1,
      pickupZone: 'GULSHAN',
      destinationZone: 'DHANMONDI',
      openToShare: true,
      maxShareSeats: 2,
    },
    create: {
      id: 'e8a00003-0000-4000-8000-000000000003',
      passengerId: shirin.id,
      poolId: pool3.id,
      pickupZone: 'GULSHAN',
      destinationZone: 'DHANMONDI',
      seats: 1,
      stage: 'REQUESTED',
      baseFarePaisa: 10000,
      distanceChargePaisa: 45000,
      poolDiscountPaisa: 0,
      totalFarePaisa: 55000,
      openToShare: true,
      maxShareSeats: 2,
      paymentMethod: 'TESLAPAY',
      paymentStatus: 'UNPAID',
      corridorId: 'CORRIDOR_WEST_EAST_REV',
    },
  });

  console.log('Seeded:', {
    jashim: jashim.email,
    bullet: bullet.name,
    nusrat: nusrat.email,
    rafiq: rafiq.email,
    shirin: shirin.email,
    pools: [pool1.id, pool2.id, pool3.id],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
