import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AdminTokenPayload, RequestMetadata } from '../types/index.js';
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
  return officers.map(publicOfficer);
}

function scopedDepartment(actor?: AdminTokenPayload, requestedDepartment?: string) {
  return actor?.role === 'REGIONAL_ADMIN' ? actor.department ?? '' : requestedDepartment;
}

function assertDepartmentAccess(actor: AdminTokenPayload | undefined, department: string) {
  if (actor?.role === 'REGIONAL_ADMIN' && department !== actor.department) {
    throw new AppError('Недостатньо прав для доступу до чужого УПП.', 403);
  }
}

export async function listOfficersScoped(filters: Record<string, unknown>, actor?: AdminTokenPayload) {
  return listOfficers({ ...filters, department: scopedDepartment(actor, typeof filters.department === 'string' ? filters.department : undefined) });
}

export async function createOfficer(input: Record<string, unknown>, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const badgeNumber = validateBadgeNumber(input.badgeNumber);
  const fullName = required(input.fullName, 'ПІБ обов’язкове.');
  const department = required(input.department, 'УПП обов’язкове.');
  assertDepartmentAccess(actor, department);
  const pin = validatePin(input.pin);
  const pinHash = await bcrypt.hash(pin, 10);
  const isActive = input.isActive !== false;
  try {
    const officer = await prisma.officer.create({ data: { badgeNumber, fullName, department, pinHash, isActive } });
    await createAuditLog({ action: 'Створено патрульного', entityType: 'officer', entityId: officer.id, badgeNumber, details: fullName, ...metadata });
    await createAuditLog({ action: 'Адміністратор встановив PIN', entityType: 'officer', entityId: officer.id, badgeNumber, details: fullName, ...metadata });
    return publicOfficer(officer);
  } catch (error) { uniqueOfficerError(error); }
}

export async function updateOfficer(id: string, input: Record<string, unknown>, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const current = await prisma.officer.findUnique({ where: { id } });
  if (!current) throw new AppError('Патрульного не знайдено.', 404);
  assertDepartmentAccess(actor, current.department);
  const badgeNumber = input.badgeNumber === undefined ? current.badgeNumber : validateBadgeNumber(input.badgeNumber);
  const fullName = input.fullName === undefined ? current.fullName : required(input.fullName, 'ПІБ обов’язкове.');
  const department = input.department === undefined ? current.department : required(input.department, 'УПП обов’язкове.');
  assertDepartmentAccess(actor, department);
  const pinHash = input.pin === undefined || input.pin === '' ? undefined : await bcrypt.hash(validatePin(input.pin), 10);
  try {
    const officer = await prisma.officer.update({
      where: { id },
      data: { badgeNumber, fullName, department, pinHash, isActive: input.isActive === undefined ? undefined : Boolean(input.isActive) },
    });
    await createAuditLog({ action: 'Оновлено патрульного', entityType: 'officer', entityId: id, badgeNumber, details: fullName, ...metadata });
    if (pinHash) await createAuditLog({ action: 'Адміністратор змінив PIN', entityType: 'officer', entityId: id, badgeNumber, details: fullName, ...metadata });
    return publicOfficer(officer);
  } catch (error) { uniqueOfficerError(error); }
}

export async function deactivateOfficer(id: string, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const current = await prisma.officer.findUnique({ where: { id } });
  if (!current) throw new AppError('Патрульного не знайдено.', 404);
  assertDepartmentAccess(actor, current.department);
  await prisma.officer.update({ where: { id }, data: { isActive: false } });
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
  if (!officer.pinHash || !await bcrypt.compare(pin, officer.pinHash)) {
    await createAuditLog({ action: 'Невдала спроба входу патрульного', entityType: 'officer', entityId: officer.id, badgeNumber, details: 'Невірні облікові дані', ...metadata });
    throw new AppError('Невірний номер жетона або PIN', 401);
  }
  const safeOfficer = { badgeNumber: officer.badgeNumber, fullName: officer.fullName, department: officer.department };
  const token = jwt.sign(safeOfficer, env.jwtSecret, { expiresIn: env.officerJwtExpiresIn as SignOptions['expiresIn'], subject: officer.id });
  await createAuditLog({ action: 'Вхід патрульного успішний', entityType: 'officer', entityId: officer.id, badgeNumber, details: officer.fullName, ...metadata });
  return { token, officer: safeOfficer };
}

export async function logoutOfficer(badgeNumber: string, metadata: RequestMetadata = {}) {
  await createAuditLog({ action: 'Вихід патрульного', entityType: 'officer', badgeNumber, ...metadata });
}
