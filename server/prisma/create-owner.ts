import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Відсутня змінна середовища ${name}.`);
    process.exit(1);
  }
  return value;
}

function validatePassword(password: string) {
  const strong = password.length >= 12
    && /[A-ZА-ЯІЇЄҐ]/.test(password)
    && /[a-zа-яіїєґ]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9]/.test(password);
  if (!strong || password.includes('CHANGE_ME')) {
    console.error('OWNER_PASSWORD має містити мінімум 12 символів, велику і малу літеру, цифру та спецсимвол. Не використовуйте CHANGE_ME.');
    process.exit(1);
  }
}

async function main() {
  const username = requiredEnv('OWNER_USERNAME');
  const fullName = requiredEnv('OWNER_FULL_NAME');
  const password = requiredEnv('OWNER_PASSWORD');
  validatePassword(password);

  const existingOwner = await prisma.adminUser.findFirst({
    where: { role: 'SYSTEM_OWNER', isDeleted: false, isActive: true },
  });
  const replace = process.env.OWNER_REPLACE === 'true';
  if (existingOwner && existingOwner.username !== username && !replace) {
    console.error(`Активний SYSTEM_OWNER вже існує: ${existingOwner.username}. Для заміни задайте OWNER_REPLACE=true.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const owner = await prisma.adminUser.upsert({
    where: { username },
    update: {
      fullName,
      role: 'SYSTEM_OWNER',
      department: null,
      unit: null,
      departmentId: null,
      departmentName: null,
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
      username,
      fullName,
      role: 'SYSTEM_OWNER',
      passwordHash,
      isActive: true,
      mustChangePassword: true,
      passwordChangedAt: null,
    },
  });

  if (replace) {
    await prisma.adminUser.updateMany({
      where: { role: 'SYSTEM_OWNER', username: { not: username }, isDeleted: false },
      data: {
        isActive: false,
        isDeleted: true,
        deletedAt: new Date(),
        deleteReason: 'Замінено через admin:create-owner',
      },
    });
  }

  console.log(`SYSTEM_OWNER готовий: ${owner.username}. Після першого входу потрібно змінити пароль і налаштувати 2FA.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
