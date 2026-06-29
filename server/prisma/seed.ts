import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

if (process.env.NODE_ENV === 'production') {
  console.error('Відмовлено: тестовий seed не можна запускати з NODE_ENV=production.');
  process.exit(1);
}

const prisma = new PrismaClient();

const TEST_ADMIN_PASSWORDS = {
  owner: 'Owner.Test-2026!',
  nationalAdmin: 'National.Test-2026!',
  regionalVolyn: 'Regional.Volyn-2026!',
  regionalLviv: 'Regional.Lviv-2026!',
} as const;

const TEST_OFFICER_PINS = {
  '0000001': '240681',
  '0000002': '240682',
  '0000003': '240683',
  '0000004': '240684',
  '0000005': '240685',
} as const;

const managements = [
  {
    name: 'УПП у Волинській області',
    code: 'VOLYN',
    region: 'Волинська область',
    units: [
      { name: 'Відділ чергової служби', type: 'відділ', code: 'VOL-CHS' },
      { name: 'Рота 1', type: 'стройовий підрозділ', code: 'VOL-R1' },
      { name: 'Відділ адміністративної практики', type: 'відділ', code: 'VOL-AP' },
    ],
  },
  {
    name: 'УПП у Львівській області',
    code: 'LVIV',
    region: 'Львівська область',
    units: [
      { name: 'Відділ моніторингу та аналітики', type: 'відділ', code: 'LV-MON' },
      { name: 'Рота 2', type: 'стройовий підрозділ', code: 'LV-R2' },
      { name: 'Сектор реагування патрульної поліції', type: 'сектор', code: 'LV-SRPP' },
    ],
  },
];

const officers = [
  { badgeNumber: '0000001', fullName: 'Тестенко Андрій Петрович', management: 'УПП у Волинській області', unit: 'Рота 1' },
  { badgeNumber: '0000002', fullName: 'Демчук Олена Сергіївна', management: 'УПП у Волинській області', unit: 'Відділ чергової служби' },
  { badgeNumber: '0000003', fullName: 'Кравець Максим Ігорович', management: 'УПП у Львівській області', unit: 'Рота 2' },
  { badgeNumber: '0000004', fullName: 'Мельник Ірина Василівна', management: 'УПП у Львівській області', unit: 'Сектор реагування патрульної поліції' },
  { badgeNumber: '0000005', fullName: 'Шевчук Назар Романович', management: 'УПП у Волинській області', unit: 'Відділ адміністративної практики' },
];

const vehicles = [
  {
    plateNumber: 'AA5200MH',
    displayPlateNumber: 'АА5200МН',
    brand: 'Hyundai',
    model: 'Sonata',
    management: 'УПП у Волинській області',
    unit: 'Рота 1',
    fuelType: 'PETROL',
    fuelConsumptionPer100Km: 10,
    fuelTankCapacityLiters: 50,
    initialFuelLiters: 20,
  },
  {
    plateNumber: 'AC1042BK',
    displayPlateNumber: 'АС1042ВК',
    brand: 'Skoda',
    model: 'Octavia',
    management: 'УПП у Волинській області',
    unit: 'Відділ чергової служби',
    fuelType: 'PETROL',
    fuelConsumptionPer100Km: 8.5,
    fuelTankCapacityLiters: 50,
    initialFuelLiters: 25,
  },
  {
    plateNumber: 'BC7310HP',
    displayPlateNumber: 'ВС7310НР',
    brand: 'Toyota',
    model: 'Corolla',
    management: 'УПП у Львівській області',
    unit: 'Рота 2',
    fuelType: 'HYBRID',
    fuelConsumptionPer100Km: 6.5,
    fuelTankCapacityLiters: 43,
    initialFuelLiters: 18,
  },
  {
    plateNumber: 'BC2804IK',
    displayPlateNumber: 'ВС2804ІК',
    brand: 'Renault',
    model: 'Duster',
    management: 'УПП у Львівській області',
    unit: 'Сектор реагування патрульної поліції',
    fuelType: 'DIESEL',
    fuelConsumptionPer100Km: 7.8,
    fuelTankCapacityLiters: 50,
    initialFuelLiters: 22,
  },
];

type DepartmentSeed = Awaited<ReturnType<typeof prisma.department.upsert>>;
type DepartmentUnitSeed = Awaited<ReturnType<typeof prisma.departmentUnit.upsert>>;

async function upsertAdmin(input: {
  username: string;
  fullName: string;
  role: string;
  password: string;
  department?: DepartmentSeed | null;
  unit?: DepartmentUnitSeed | null;
}) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.adminUser.upsert({
    where: { username: input.username },
    update: {
      fullName: input.fullName,
      role: input.role,
      department: input.department?.name ?? null,
      unit: input.unit?.name ?? null,
      departmentId: input.department?.id ?? null,
      departmentName: input.department?.name ?? null,
      passwordHash,
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      mustChangePassword: true,
      passwordChangedAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      twoFactorLastVerifiedAt: null,
      twoFactorRecoveryCodesHash: null,
    },
    create: {
      username: input.username,
      fullName: input.fullName,
      role: input.role,
      department: input.department?.name ?? null,
      unit: input.unit?.name ?? null,
      departmentId: input.department?.id ?? null,
      departmentName: input.department?.name ?? null,
      passwordHash,
      isActive: true,
      mustChangePassword: true,
      passwordChangedAt: null,
    },
  });
}

async function main() {
  const departmentByName = new Map<string, DepartmentSeed>();
  const unitByDepartmentAndName = new Map<string, DepartmentUnitSeed>();

  for (const management of managements) {
    const department = await prisma.department.upsert({
      where: { name: management.name },
      update: {
        code: management.code,
        region: management.region,
        isActive: true,
        isDeleted: false,
        deletedAt: null,
      },
      create: {
        name: management.name,
        code: management.code,
        region: management.region,
        isActive: true,
      },
    });
    departmentByName.set(department.name, department);

    for (const unitSeed of management.units) {
      const unit = await prisma.departmentUnit.upsert({
        where: { departmentId_name: { departmentId: department.id, name: unitSeed.name } },
        update: {
          type: unitSeed.type,
          code: unitSeed.code,
          isActive: true,
          isDeleted: false,
          deletedAt: null,
        },
        create: {
          departmentId: department.id,
          name: unitSeed.name,
          type: unitSeed.type,
          code: unitSeed.code,
          isActive: true,
        },
      });
      unitByDepartmentAndName.set(`${department.name}:${unit.name}`, unit);
    }
  }

  const volyn = departmentByName.get('УПП у Волинській області');
  const lviv = departmentByName.get('УПП у Львівській області');
  const volynAdminUnit = volyn ? unitByDepartmentAndName.get(`${volyn.name}:Відділ чергової служби`) : null;
  const lvivAdminUnit = lviv ? unitByDepartmentAndName.get(`${lviv.name}:Відділ моніторингу та аналітики`) : null;

  await upsertAdmin({
    username: 'owner.test',
    fullName: 'Тестовий Власник Системи',
    role: 'SYSTEM_OWNER',
    password: TEST_ADMIN_PASSWORDS.owner,
  });
  await upsertAdmin({
    username: 'national.test',
    fullName: 'Тестовий Національний Адміністратор',
    role: 'NATIONAL_ADMIN',
    password: TEST_ADMIN_PASSWORDS.nationalAdmin,
  });
  if (volyn) {
    await upsertAdmin({
      username: 'volyn.admin',
      fullName: 'Тестовий Адміністратор Волинського УПП',
      role: 'REGIONAL_ADMIN',
      password: TEST_ADMIN_PASSWORDS.regionalVolyn,
      department: volyn,
      unit: volynAdminUnit,
    });
  }
  if (lviv) {
    await upsertAdmin({
      username: 'lviv.admin',
      fullName: 'Тестовий Адміністратор Львівського УПП',
      role: 'REGIONAL_ADMIN',
      password: TEST_ADMIN_PASSWORDS.regionalLviv,
      department: lviv,
      unit: lvivAdminUnit,
    });
  }

  await prisma.adminUser.updateMany({
    where: {
      username: { in: ['owner', 'superadmin1', 'superadmin2'] },
    },
    data: { isActive: false, isDeleted: true, deletedAt: new Date(), deleteReason: 'Застарілий seed-акаунт' },
  });

  for (const officer of officers) {
    const department = departmentByName.get(officer.management);
    const unit = department ? unitByDepartmentAndName.get(`${department.name}:${officer.unit}`) : null;
    const pinHash = await bcrypt.hash(TEST_OFFICER_PINS[officer.badgeNumber as keyof typeof TEST_OFFICER_PINS], 10);
    await prisma.officer.upsert({
      where: { badgeNumber: officer.badgeNumber },
      update: {
        fullName: officer.fullName,
        department: department?.name ?? officer.management,
        unit: unit?.name ?? officer.unit,
        departmentId: department?.id ?? null,
        departmentName: department?.name ?? officer.management,
        departmentUnitId: unit?.id ?? null,
        departmentUnitName: unit?.name ?? officer.unit,
        pinHash,
        isActive: true,
        isDeleted: false,
        deletedAt: null,
      },
      create: {
        badgeNumber: officer.badgeNumber,
        fullName: officer.fullName,
        department: department?.name ?? officer.management,
        unit: unit?.name ?? officer.unit,
        departmentId: department?.id ?? null,
        departmentName: department?.name ?? officer.management,
        departmentUnitId: unit?.id ?? null,
        departmentUnitName: unit?.name ?? officer.unit,
        pinHash,
        isActive: true,
      },
    });
  }

  for (const vehicle of vehicles) {
    const department = departmentByName.get(vehicle.management);
    const unit = department ? unitByDepartmentAndName.get(`${department.name}:${vehicle.unit}`) : null;
    await prisma.vehicle.upsert({
      where: { plateNumber: vehicle.plateNumber },
      update: {
        displayPlateNumber: vehicle.displayPlateNumber,
        brand: vehicle.brand,
        model: vehicle.model,
        department: department?.name ?? vehicle.management,
        unit: unit?.name ?? vehicle.unit,
        departmentId: department?.id ?? null,
        departmentName: department?.name ?? vehicle.management,
        departmentUnitId: unit?.id ?? null,
        departmentUnitName: unit?.name ?? vehicle.unit,
        fuelType: vehicle.fuelType,
        fuelConsumptionPer100Km: vehicle.fuelConsumptionPer100Km,
        fuelTankCapacityLiters: vehicle.fuelTankCapacityLiters,
        initialFuelLiters: vehicle.initialFuelLiters,
        isActive: true,
        isDeleted: false,
        deletedAt: null,
      },
      create: {
        plateNumber: vehicle.plateNumber,
        displayPlateNumber: vehicle.displayPlateNumber,
        brand: vehicle.brand,
        model: vehicle.model,
        department: department?.name ?? vehicle.management,
        unit: unit?.name ?? vehicle.unit,
        departmentId: department?.id ?? null,
        departmentName: department?.name ?? vehicle.management,
        departmentUnitId: unit?.id ?? null,
        departmentUnitName: unit?.name ?? vehicle.unit,
        fuelType: vehicle.fuelType,
        fuelConsumptionPer100Km: vehicle.fuelConsumptionPer100Km,
        fuelTankCapacityLiters: vehicle.fuelTankCapacityLiters,
        initialFuelLiters: vehicle.initialFuelLiters,
        isActive: true,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      action: 'Seed тестових даних виконано',
      entityType: 'seed',
      details: `${managements.length} УПП; ${officers.length} патрульних; ${vehicles.length} автомобілів`,
    },
  });

  console.log('Seed complete.');
  console.log('Admin test credentials:');
  console.log(`- owner.test / ${TEST_ADMIN_PASSWORDS.owner}`);
  console.log(`- national.test / ${TEST_ADMIN_PASSWORDS.nationalAdmin}`);
  console.log(`- volyn.admin / ${TEST_ADMIN_PASSWORDS.regionalVolyn}`);
  console.log(`- lviv.admin / ${TEST_ADMIN_PASSWORDS.regionalLviv}`);
  console.log('Officer test credentials:');
  for (const [badgeNumber, pin] of Object.entries(TEST_OFFICER_PINS)) {
    console.log(`- ${badgeNumber} / ${pin}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
