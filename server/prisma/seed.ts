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

const departments = [
  { name: 'УПП у Волинській області', code: 'VOLYN', region: 'Волинська область' },
  { name: 'УПП у м. Києві', code: 'KYIV_CITY', region: 'м. Київ' },
  { name: 'УПП у Львівській області', code: 'LVIV', region: 'Львівська область' },
];

const defaultUnits = ['Апарат', 'Пресслужба', 'Адміністративна практика', 'ТОР', 'ГОР', 'ТАКТІМ', 'Батальйон 1', 'Рота 1'];

async function main() {
  const departmentByName = new Map<string, { id: string; name: string }>();
  for (const department of departments) {
    const item = await prisma.department.upsert({
      where: { name: department.name },
      update: { code: department.code, region: department.region, isActive: true },
      create: { ...department, isActive: true },
    });
    departmentByName.set(item.name, item);
    for (const unitName of defaultUnits) {
      await prisma.departmentUnit.upsert({
        where: { departmentId_name: { departmentId: item.id, name: unitName } },
        update: { isActive: true },
        create: { departmentId: item.id, name: unitName, isActive: true },
      });
    }
  }

  const owner = await prisma.adminUser.findUnique({ where: { username: 'owner' } });
  if (owner) {
    await prisma.adminUser.update({
      where: { username: 'owner' },
      data: {
        fullName: 'Левіс Артур Сергійович',
        role: 'SYSTEM_OWNER',
        department: null,
        departmentId: null,
        departmentName: null,
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
        departmentId: null,
        departmentName: null,
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
    const department = departmentByName.get(officer.department);
    await prisma.officer.upsert({
      where: { badgeNumber: officer.badgeNumber },
      update: { ...officerData, departmentId: department?.id, departmentName: department?.name ?? officer.department, pinHash, isActive: true },
      create: { ...officerData, departmentId: department?.id, departmentName: department?.name ?? officer.department, pinHash },
    });
  }
  for (const vehicle of vehicles) {
    const department = departmentByName.get(vehicle.department);
    await prisma.vehicle.upsert({
      where: { plateNumber: vehicle.plateNumber },
      update: { ...vehicle, departmentId: department?.id, departmentName: department?.name ?? vehicle.department, isActive: true },
      create: { ...vehicle, departmentId: department?.id, departmentName: department?.name ?? vehicle.department, isActive: true },
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
