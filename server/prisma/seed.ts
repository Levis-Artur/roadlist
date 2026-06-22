import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const officers = [
  { badgeNumber: '0000001', fullName: 'Іваненко Іван Іванович', department: 'УПП у Волинській області', pin: '1111' },
  { badgeNumber: '0000002', fullName: 'Петренко Петро Петрович', department: 'УПП у м. Києві', pin: '2222' },
  { badgeNumber: '0000003', fullName: 'Сидоренко Андрій Миколайович', department: 'УПП у Львівській області', pin: '3333' },
];

const pilotDepartment = process.env.PILOT_DEPARTMENT ?? 'УПП у Волинській області';

const vehicles = [
  {
    plateNumber: 'AA5200MH',
    displayPlateNumber: 'АА5200МН',
    brand: 'Hyundai',
    model: 'Sonata',
    department: pilotDepartment,
  },
];

async function main() {
  const legacyBadges = ['000001', '000002', '000003'];
  await prisma.officer.updateMany({ where: { badgeNumber: { in: legacyBadges } }, data: { isActive: false } });
  await prisma.pilotOfficerAccess.updateMany({ where: { badgeNumber: { in: legacyBadges } }, data: { isActive: false } });
  for (const officer of officers) {
    const { pin, ...officerData } = officer;
    const pinHash = await bcrypt.hash(pin, 10);
    await prisma.officer.upsert({
      where: { badgeNumber: officer.badgeNumber },
      update: { ...officerData, pinHash, isActive: true },
      create: { ...officerData, pinHash },
    });
  }
  await prisma.vehicle.updateMany({ data: { isPilotActive: false } });
  for (const vehicle of vehicles) {
    await prisma.vehicle.upsert({
      where: { plateNumber: vehicle.plateNumber },
      update: { ...vehicle, isPilotActive: true, isActive: true },
      create: { ...vehicle, isActive: true },
    });
  }
  for (const officer of officers) {
    await prisma.pilotOfficerAccess.upsert({
      where: { badgeNumber: officer.badgeNumber },
      update: { department: pilotDepartment, isActive: true },
      create: { badgeNumber: officer.badgeNumber, department: pilotDepartment },
    });
  }
  console.log(`Seeded ${officers.length} officers, ${vehicles.length} vehicles and ${officers.length} pilot access records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
