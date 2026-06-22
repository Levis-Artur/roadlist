import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import type { RequestMetadata } from '../types/index.js';
import { createAuditLog } from './audit.service.js';
import { validateBadgeNumber } from '../utils/badgeNumber.js';

const PIN_PATTERN = /^\d{4,8}$/;
const PIN_ERROR = 'PIN має містити від 4 до 8 цифр.';

function validatePin(value: unknown): string {
  const pin = typeof value === 'string' ? value : '';
  if (!PIN_PATTERN.test(pin)) throw new AppError(PIN_ERROR, 400);
  return pin;
}

function publicOfficer<T extends { pinHash?: string | null }>(officer: T) {
  const { pinHash, ...safeOfficer } = officer;
  return { ...safeOfficer, hasPin: Boolean(pinHash) };
}

function required(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AppError(message, 400);
  return value.trim();
}

function uniqueOfficerError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError('Патрульний з таким номером жетона вже існує', 409);
  }
  throw error;
}

export async function verifyOfficer(badgeNumber: string, metadata: RequestMetadata = {}) {
  const normalizedBadge = validateBadgeNumber(badgeNumber);
  const officer = await prisma.officer.findFirst({
    where: { badgeNumber: normalizedBadge, isActive: true },
    select: { badgeNumber: true, fullName: true, department: true },
  });
  if (officer && env.pilotMode) {
    const pilotAccess = await prisma.pilotOfficerAccess.findFirst({
      where: { badgeNumber: normalizedBadge, department: env.pilotDepartment, isActive: true },
    });
    if (!pilotAccess) {
      await createAuditLog({ action: 'Відмовлено у доступі до пілоту', entityType: 'officer', badgeNumber: normalizedBadge, ...metadata });
      throw new AppError('Цей працівник не включений до пілотного тестування.', 403);
    }
  }
  await createAuditLog({
    action: officer ? 'Перевірка жетона успішна' : 'Жетон не знайдено', entityType: 'officer',
    badgeNumber: normalizedBadge, details: officer?.fullName, ...metadata,
  });
  return officer;
}

export async function listOfficers(filters: Record<string, unknown>) {
  const search = typeof filters.search === 'string' ? filters.search.trim() : '';
  const department = typeof filters.department === 'string' ? filters.department.trim() : '';
  const isActive = filters.isActive === 'true' ? true : filters.isActive === 'false' ? false : undefined;
  const officers = await prisma.officer.findMany({
    where: {
      isActive,
      department: department ? { contains: department, mode: 'insensitive' } : undefined,
      OR: search ? [
        { badgeNumber: { contains: search } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ] : undefined,
    },
    orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
  });
  const accesses = await prisma.pilotOfficerAccess.findMany({
    where: { badgeNumber: { in: officers.map((officer) => officer.badgeNumber) } },
  });
  const accessMap = new Map(accesses.map((access) => [access.badgeNumber, access.isActive]));
  const pilotFilter = filters.isPilotAllowed === 'true' ? true : filters.isPilotAllowed === 'false' ? false : undefined;
  return officers
    .map((officer) => ({ ...publicOfficer(officer), isPilotAllowed: accessMap.get(officer.badgeNumber) ?? false }))
    .filter((officer) => pilotFilter === undefined || officer.isPilotAllowed === pilotFilter);
}

export async function createOfficer(input: Record<string, unknown>, metadata: RequestMetadata = {}) {
  const badgeNumber = validateBadgeNumber(input.badgeNumber);
  const fullName = required(input.fullName, 'ПІБ обов’язкове.');
  const department = required(input.department, 'УПП обов’язкове.');
  const pin = validatePin(input.pin);
  const pinHash = await bcrypt.hash(pin, 10);
  const isActive = input.isActive !== false;
  const isPilotAllowed = input.isPilotAllowed === true;
  try {
    const officer = await prisma.$transaction(async (transaction) => {
      const created = await transaction.officer.create({ data: { badgeNumber, fullName, department, pinHash, isActive } });
      if (isPilotAllowed) {
        await transaction.pilotOfficerAccess.create({ data: { badgeNumber, department, isActive: true } });
      }
      return created;
    });
    await createAuditLog({ action: 'Створено патрульного', entityType: 'officer', entityId: officer.id, badgeNumber, details: fullName, ...metadata });
    await createAuditLog({ action: 'Адміністратор встановив PIN', entityType: 'officer', entityId: officer.id, badgeNumber, details: fullName, ...metadata });
    if (isPilotAllowed) await createAuditLog({ action: 'Змінено доступ до пілоту', entityType: 'officer', entityId: officer.id, badgeNumber, details: 'Доступ увімкнено', ...metadata });
    return { ...publicOfficer(officer), isPilotAllowed };
  } catch (error) { uniqueOfficerError(error); }
}

export async function updateOfficer(id: string, input: Record<string, unknown>, metadata: RequestMetadata = {}) {
  const current = await prisma.officer.findUnique({ where: { id } });
  if (!current) throw new AppError('Патрульного не знайдено.', 404);
  const badgeNumber = input.badgeNumber === undefined ? current.badgeNumber : validateBadgeNumber(input.badgeNumber);
  const fullName = input.fullName === undefined ? current.fullName : required(input.fullName, 'ПІБ обов’язкове.');
  const department = input.department === undefined ? current.department : required(input.department, 'УПП обов’язкове.');
  const existingAccess = await prisma.pilotOfficerAccess.findUnique({ where: { badgeNumber: current.badgeNumber } });
  const isPilotAllowed = input.isPilotAllowed === undefined ? existingAccess?.isActive ?? false : input.isPilotAllowed === true;
  const pinHash = input.pin === undefined || input.pin === '' ? undefined : await bcrypt.hash(validatePin(input.pin), 10);
  try {
    const officer = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.officer.update({
        where: { id },
        data: { badgeNumber, fullName, department, pinHash, isActive: input.isActive === undefined ? undefined : Boolean(input.isActive) },
      });
      if (existingAccess) {
        await transaction.pilotOfficerAccess.update({ where: { id: existingAccess.id }, data: { badgeNumber, department, isActive: isPilotAllowed } });
      } else if (isPilotAllowed) {
        await transaction.pilotOfficerAccess.create({ data: { badgeNumber, department, isActive: true } });
      }
      return updated;
    });
    await createAuditLog({ action: 'Оновлено патрульного', entityType: 'officer', entityId: id, badgeNumber, details: fullName, ...metadata });
    if (pinHash) await createAuditLog({ action: 'Адміністратор змінив PIN', entityType: 'officer', entityId: id, badgeNumber, details: fullName, ...metadata });
    if (input.isPilotAllowed !== undefined) await createAuditLog({ action: 'Змінено доступ до пілоту', entityType: 'officer', entityId: id, badgeNumber, details: isPilotAllowed ? 'Доступ увімкнено' : 'Доступ вимкнено', ...metadata });
    return { ...publicOfficer(officer), isPilotAllowed };
  } catch (error) { uniqueOfficerError(error); }
}

export async function deactivateOfficer(id: string, metadata: RequestMetadata = {}) {
  const current = await prisma.officer.findUnique({ where: { id } });
  if (!current) throw new AppError('Патрульного не знайдено.', 404);
  await prisma.$transaction([
    prisma.officer.update({ where: { id }, data: { isActive: false } }),
    prisma.pilotOfficerAccess.updateMany({ where: { badgeNumber: current.badgeNumber }, data: { isActive: false } }),
  ]);
  await createAuditLog({ action: 'Деактивовано патрульного', entityType: 'officer', entityId: id, badgeNumber: current.badgeNumber, details: current.fullName, ...metadata });
}

export async function loginOfficer(badgeValue: unknown, pinValue: unknown, metadata: RequestMetadata = {}) {
  let badgeNumber: string;
  let pin: string;
  try {
    badgeNumber = validateBadgeNumber(badgeValue);
    pin = validatePin(pinValue);
  } catch (error) {
    await createAuditLog({
      action: 'Невдала спроба входу патрульного',
      entityType: 'officer',
      badgeNumber: typeof badgeValue === 'string' ? badgeValue.slice(0, 32) : undefined,
      details: 'Невалідний формат облікових даних',
      ...metadata,
    });
    throw error;
  }
  const officer = await prisma.officer.findUnique({ where: { badgeNumber } });
  if (!officer) {
    await createAuditLog({ action: 'Невдала спроба входу патрульного', entityType: 'officer', badgeNumber, details: 'Невірні облікові дані', ...metadata });
    throw new AppError('Невірний номер жетона або PIN', 401);
  }
  if (!officer.isActive) {
    await createAuditLog({ action: 'Невдала спроба входу патрульного', entityType: 'officer', entityId: officer.id, badgeNumber, details: 'Обліковий запис неактивний', ...metadata });
    throw new AppError('Обліковий запис патрульного неактивний', 403);
  }
  if (env.pilotMode) {
    const pilotAccess = await prisma.pilotOfficerAccess.findFirst({
      where: { badgeNumber, department: env.pilotDepartment, isActive: true },
    });
    if (!pilotAccess) {
      await createAuditLog({ action: 'Невдала спроба входу патрульного', entityType: 'officer', entityId: officer.id, badgeNumber, details: 'Немає доступу до пілоту', ...metadata });
      throw new AppError('Цей працівник не включений до пілотного тестування', 403);
    }
  }
  if (!officer.pinHash || !await bcrypt.compare(pin, officer.pinHash)) {
    await createAuditLog({ action: 'Невдала спроба входу патрульного', entityType: 'officer', entityId: officer.id, badgeNumber, details: 'Невірні облікові дані', ...metadata });
    throw new AppError('Невірний номер жетона або PIN', 401);
  }
  const safeOfficer = { badgeNumber: officer.badgeNumber, fullName: officer.fullName, department: officer.department };
  const token = jwt.sign(safeOfficer, env.jwtSecret, { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'], subject: officer.id });
  await createAuditLog({ action: 'Вхід патрульного успішний', entityType: 'officer', entityId: officer.id, badgeNumber, details: officer.fullName, ...metadata });
  return { token, officer: safeOfficer };
}

export async function logoutOfficer(badgeNumber: string, metadata: RequestMetadata = {}) {
  await createAuditLog({ action: 'Вихід патрульного', entityType: 'officer', badgeNumber, ...metadata });
}
