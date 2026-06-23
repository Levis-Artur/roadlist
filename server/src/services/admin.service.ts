import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AdminRole, AdminTokenPayload, RequestMetadata } from '../types/index.js';
import { createAuditLog } from './audit.service.js';

const ADMIN_ROLES: AdminRole[] = ['SYSTEM_OWNER', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN'];
const OWNER_LOCK_MESSAGE = 'Неможливо змінити системного власника через адміністративну панель';

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && ADMIN_ROLES.includes(value as AdminRole);
}

function publicAdmin<T extends { passwordHash?: string }>(admin: T) {
  const { passwordHash, ...safeAdmin } = admin;
  return safeAdmin;
}

function required(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AppError(message, 400);
  return value.trim();
}

function actorMetadata(actor: AdminTokenPayload | undefined, metadata: RequestMetadata): RequestMetadata {
  return {
    ...metadata,
    actorAdminId: actor?.adminId,
    actorUsername: actor?.username,
    actorRole: actor?.role,
    actorDepartment: actor?.department ?? null,
  };
}

function ensureCanCreateRole(actor: AdminTokenPayload, role: AdminRole) {
  if (role === 'SYSTEM_OWNER') throw new AppError(OWNER_LOCK_MESSAGE, 403);
  if (actor.role === 'SYSTEM_OWNER') return;
  if (actor.role === 'NATIONAL_ADMIN' && role === 'REGIONAL_ADMIN') return;
  throw new AppError('Недостатньо прав для створення адміністратора з цією роллю', 403);
}

function ensureCanManageTarget(actor: AdminTokenPayload, targetRole: AdminRole) {
  if (targetRole === 'SYSTEM_OWNER') throw new AppError(OWNER_LOCK_MESSAGE, 403);
  if (actor.role === 'SYSTEM_OWNER') return;
  if (actor.role === 'NATIONAL_ADMIN' && targetRole === 'REGIONAL_ADMIN') return;
  throw new AppError('Недостатньо прав для зміни цього адміністратора', 403);
}

async function auditForbiddenOwnerAction(actor: AdminTokenPayload, metadata: RequestMetadata, details: string) {
  await createAuditLog({
    action: 'Спроба забороненої дії з SYSTEM_OWNER',
    entityType: 'admin',
    details,
    ...actorMetadata(actor, metadata),
  }).catch(() => undefined);
}

function validateRole(value: unknown): AdminRole {
  if (!isAdminRole(value)) throw new AppError('Невідома роль адміністратора.', 400);
  return value;
}

function validateDepartment(role: AdminRole, value: unknown): string | null {
  if (role !== 'REGIONAL_ADMIN') return null;
  return required(value, 'УПП обов’язкове для регіонального адміністратора.');
}

function uniqueAdminError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError('Адміністратор з таким логіном вже існує', 409);
  }
  throw error;
}

export async function loginAdmin(usernameValue: unknown, passwordValue: unknown, metadata: RequestMetadata = {}) {
  const username = required(usernameValue, 'Логін адміністратора обов’язковий.');
  const password = required(passwordValue, 'Пароль адміністратора обов’язковий.');
  const admin = await prisma.adminUser.findUnique({ where: { username } });
  if (!admin || !admin.isActive || !await bcrypt.compare(password, admin.passwordHash)) {
    await createAuditLog({ action: 'Невдала спроба входу адміністратора', entityType: 'admin', details: username, ...metadata });
    throw new AppError('Невірний логін або пароль адміністратора', 401);
  }
  const role = validateRole(admin.role);
  const payload: AdminTokenPayload = { adminId: admin.id, username: admin.username, role, department: admin.department };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'], subject: admin.id });
  await createAuditLog({
    action: `Вхід ${role}`,
    entityType: 'admin',
    entityId: admin.id,
    details: admin.username,
    actorAdminId: admin.id,
    actorUsername: admin.username,
    actorRole: role,
    actorDepartment: admin.department,
    ...metadata,
  });
  return { token, admin: publicAdmin({ ...admin, role }) };
}

export async function listAdminUsers(actor: AdminTokenPayload) {
  const where: Prisma.AdminUserWhereInput = actor.role === 'SYSTEM_OWNER'
    ? {}
    : { role: 'REGIONAL_ADMIN' };
  const admins = await prisma.adminUser.findMany({ where, orderBy: [{ role: 'asc' }, { username: 'asc' }] });
  return admins.map(publicAdmin);
}

export async function createAdminUser(actor: AdminTokenPayload, input: Record<string, unknown>, metadata: RequestMetadata = {}) {
  const role = validateRole(input.role);
  if (role === 'SYSTEM_OWNER') {
    await auditForbiddenOwnerAction(actor, metadata, 'Спроба створити другого SYSTEM_OWNER');
    throw new AppError(OWNER_LOCK_MESSAGE, 403);
  }
  ensureCanCreateRole(actor, role);
  const username = required(input.username, 'Логін обов’язковий.');
  const fullName = required(input.fullName, 'ПІБ обов’язкове.');
  const department = validateDepartment(role, input.department);
  const password = required(input.password, 'Пароль обов’язковий.');
  try {
    const admin = await prisma.adminUser.create({
      data: {
        username,
        fullName,
        role,
        department,
        passwordHash: await bcrypt.hash(password, 10),
        isActive: input.isActive !== false,
        createdById: actor.adminId,
      },
    });
    await createAuditLog({
      action: `${actor.role} створив ${role}`,
      entityType: 'admin',
      entityId: admin.id,
      details: admin.username,
      targetAdminId: admin.id,
      targetRole: role,
      targetDepartment: department,
      ...actorMetadata(actor, metadata),
    });
    return publicAdmin(admin);
  } catch (error) { uniqueAdminError(error); }
}

export async function updateAdminUser(actor: AdminTokenPayload, id: string, input: Record<string, unknown>, metadata: RequestMetadata = {}) {
  const current = await prisma.adminUser.findUnique({ where: { id } });
  if (!current) throw new AppError('Адміністратора не знайдено.', 404);
  const currentRole = validateRole(current.role);
  if (currentRole === 'SYSTEM_OWNER') {
    await auditForbiddenOwnerAction(actor, metadata, `Спроба змінити SYSTEM_OWNER: ${current.username}`);
    throw new AppError(OWNER_LOCK_MESSAGE, 403);
  }
  ensureCanManageTarget(actor, currentRole);
  const nextRole = input.role === undefined ? currentRole : validateRole(input.role);
  if (nextRole === 'SYSTEM_OWNER') {
    await auditForbiddenOwnerAction(actor, metadata, `Спроба призначити роль SYSTEM_OWNER: ${current.username}`);
    throw new AppError(OWNER_LOCK_MESSAGE, 403);
  }
  ensureCanManageTarget(actor, nextRole);
  const passwordHash = typeof input.password === 'string' && input.password.trim()
    ? await bcrypt.hash(input.password.trim(), 10)
    : undefined;
  try {
    const admin = await prisma.adminUser.update({
      where: { id },
      data: {
        username: input.username === undefined ? undefined : required(input.username, 'Логін обов’язковий.'),
        fullName: input.fullName === undefined ? undefined : required(input.fullName, 'ПІБ обов’язкове.'),
        role: nextRole,
        department: input.department === undefined && nextRole === currentRole ? undefined : validateDepartment(nextRole, input.department ?? current.department),
        passwordHash,
        isActive: input.isActive === undefined ? undefined : Boolean(input.isActive),
      },
    });
    await createAuditLog({
      action: passwordHash ? 'Пароль адміністратора змінено' : 'Адміністратора оновлено',
      entityType: 'admin',
      entityId: admin.id,
      details: admin.username,
      targetAdminId: admin.id,
      targetRole: validateRole(admin.role),
      targetDepartment: admin.department,
      ...actorMetadata(actor, metadata),
    });
    return publicAdmin(admin);
  } catch (error) { uniqueAdminError(error); }
}

export async function deactivateAdminUser(actor: AdminTokenPayload, id: string, metadata: RequestMetadata = {}) {
  const current = await prisma.adminUser.findUnique({ where: { id } });
  if (!current) throw new AppError('Адміністратора не знайдено.', 404);
  const currentRole = validateRole(current.role);
  if (currentRole === 'SYSTEM_OWNER') {
    await auditForbiddenOwnerAction(actor, metadata, `Спроба деактивувати SYSTEM_OWNER: ${current.username}`);
    throw new AppError(OWNER_LOCK_MESSAGE, 403);
  }
  ensureCanManageTarget(actor, currentRole);
  const admin = await prisma.adminUser.update({ where: { id }, data: { isActive: false } });
  await createAuditLog({
    action: 'Адміністратор деактивований',
    entityType: 'admin',
    entityId: admin.id,
    details: admin.username,
    targetAdminId: admin.id,
    targetRole: currentRole,
    targetDepartment: admin.department,
    ...actorMetadata(actor, metadata),
  });
}
