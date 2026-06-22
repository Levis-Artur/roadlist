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
  console.log(`Seeded ${officers.length} officers and ${vehicles.length} vehicles.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
