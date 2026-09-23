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
    update: {},
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

  await prisma.user.upsert({
    where: { email: 'shirin@gmail.com' },
    update: {},
    create: { name: 'Shirin', email: 'shirin@gmail.com', passwordHash, role: 'PASSENGER' },
  });

  console.log('Seeded:', { jashim: jashim.email, bullet: bullet.name, nusrat: nusrat.email, rafiq: rafiq.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
