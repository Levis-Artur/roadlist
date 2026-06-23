import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const officers = [
  { badgeNumber: '0000001', fullName: 'Іваненко Іван Іванович', department: 'УПП у Волинській області', pin: '1111' },
  { badgeNumber: '0000002', fullName: 'Петренко Петро Петрович', department: 'УПП у м. Києві', pin: '2222' },
  { badgeNumber: '0000003', fullName: 'Сидоренко Андрій Миколайович', department: 'УПП у Львівській області', pin: '3333' },
];

const vehicles = [
  {
    plateNumber: 'AA5200MH',
    displayPlateNumber: 'АА5200МН',
    brand: 'Hyundai',
    model: 'Sonata',
    department: 'УПП у Волинській області',
  },
];

async function main() {
  const owner = await prisma.adminUser.findUnique({ where: { username: 'owner' } });
  if (owner) {
    await prisma.adminUser.update({
      where: { username: 'owner' },
      data: {
        fullName: 'Левіс Артур Сергійович',
        role: 'SYSTEM_OWNER',
        department: null,
        isActive: true,
        createdById: null,
      },
    });
  } else {
    const ownerPasswordHash = await bcrypt.hash('owner12345', 10);
    await prisma.adminUser.create({
      data: {
        username: 'owner',
        fullName: 'Левіс Артур Сергійович',
        role: 'SYSTEM_OWNER',
        department: null,
        passwordHash: ownerPasswordHash,
        isActive: true,
        mustChangePassword: true,
        passwordChangedAt: null,
        createdById: null,
      },
    });
  }
  await prisma.adminUser.updateMany({
    where: { username: { in: ['superadmin1', 'superadmin2'] } },
    data: { isActive: false },
  });
  await prisma.adminUser.updateMany({
    where: { role: 'SYSTEM_OWNER', username: { not: 'owner' } },
    data: { isActive: false },
  });

  const legacyBadges = ['000001', '000002', '000003'];
  await prisma.officer.updateMany({ where: { badgeNumber: { in: legacyBadges } }, data: { isActive: false } });
  for (const officer of officers) {
    const { pin, ...officerData } = officer;
    const pinHash = await bcrypt.hash(pin, 10);
    await prisma.officer.upsert({
      where: { badgeNumber: officer.badgeNumber },
      update: { ...officerData, pinHash, isActive: true },
      create: { ...officerData, pinHash },
    });
  }
  for (const vehicle of vehicles) {
    await prisma.vehicle.upsert({
      where: { plateNumber: vehicle.plateNumber },
      update: { ...vehicle, isActive: true },
      create: { ...vehicle, isActive: true },
    });
  }
  console.log(`Seeded 1 system owner, ${officers.length} officers and ${vehicles.length} vehicles.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
