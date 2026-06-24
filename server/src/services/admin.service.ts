import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AdminRole, AdminTokenPayload, AdminTwoFactorPendingPayload, RequestMetadata } from '../types/index.js';
import { createAuditLog } from './audit.service.js';

const ADMIN_ROLES: AdminRole[] = ['SYSTEM_OWNER', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN'];
const OWNER_LOCK_MESSAGE = 'Неможливо змінити системного власника через адміністративну панель';
export const PASSWORD_POLICY_MESSAGE = 'Пароль має містити мінімум 12 символів, велику і малу літеру, цифру та спецсимвол.';
const LOCK_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;
const IP_WINDOW_MS = 15 * 60 * 1000;
const MAX_IP_ATTEMPTS = 20;
const ipLoginAttempts = new Map<string, number[]>();

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && ADMIN_ROLES.includes(value as AdminRole);
}

function publicAdmin<T extends { passwordHash?: string; twoFactorSecret?: string | null; twoFactorRecoveryCodesHash?: string | null }>(admin: T) {
  const { passwordHash, twoFactorSecret, twoFactorRecoveryCodesHash, ...safeAdmin } = admin;
  return safeAdmin;
}

function required(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AppError(message, 400);
  return value.trim();
}

function validatePasswordPolicy(value: unknown): string {
  const password = required(value, PASSWORD_POLICY_MESSAGE);
  if (
    password.length < 12
    || !/[A-ZА-ЯІЇЄҐ]/.test(password)
    || !/[a-zа-яіїєґ]/.test(password)
    || !/\d/.test(password)
    || !/[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9]/.test(password)
  ) throw new AppError(PASSWORD_POLICY_MESSAGE, 400);
  return password;
}

function actorMetadata(actor: AdminTokenPayload | undefined, metadata: RequestMetadata): RequestMetadata {
  return {
    ...metadata,
    actorAdminId: actor?.adminId,
    actorUsername: actor?.username,
    actorRole: actor?.role,
    actorDepartment: actor?.department ?? null,
    actorUnit: actor?.unit ?? null,
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
  await createAuditLog({ action: 'Спроба забороненої дії з SYSTEM_OWNER', entityType: 'admin', details, ...actorMetadata(actor, metadata) }).catch(() => undefined);
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
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('Адміністратор з таким логіном вже існує', 409);
  throw error;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function fullAdminToken(admin: { id: string; username: string; role: string; department: string | null; unit?: string | null; mustChangePassword: boolean }) {
  const role = validateRole(admin.role);
  const payload: AdminTokenPayload = { adminId: admin.id, username: admin.username, role, department: admin.department, unit: admin.unit ?? null, mustChangePassword: admin.mustChangePassword };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.adminJwtExpiresIn as SignOptions['expiresIn'], subject: admin.id });
}

function pendingAdminToken(admin: { id: string; username: string; role: string; department: string | null; unit?: string | null; mustChangePassword: boolean }) {
  const role = validateRole(admin.role);
  const payload: AdminTwoFactorPendingPayload = {
    adminId: admin.id,
    username: admin.username,
    role,
    department: admin.department,
    unit: admin.unit ?? null,
    purpose: 'ADMIN_2FA_PENDING',
    mustChangePassword: admin.mustChangePassword,
  };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.adminTwoFactorPendingExpiresIn as SignOptions['expiresIn'], subject: admin.id });
}

export function verifyPendingToken(tokenValue: unknown): AdminTwoFactorPendingPayload {
  const token = required(tokenValue, 'Потрібен тимчасовий token 2FA.');
  const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload & AdminTwoFactorPendingPayload;
  if (payload.purpose !== 'ADMIN_2FA_PENDING' || !payload.adminId || !payload.username || !isAdminRole(payload.role)) {
    throw new AppError('Недійсний або прострочений тимчасовий token 2FA.', 401);
  }
  return payload;
}

export async function verifyAdminToken(tokenValue: unknown): Promise<AdminTokenPayload> {
  const token = required(tokenValue, 'Потрібна авторизація адміністратора.');
  const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload & AdminTokenPayload;
  if (!payload.adminId || !payload.username || !isAdminRole(payload.role)) {
    throw new AppError('Потрібна авторизація адміністратора', 401);
  }
  const admin = await prisma.adminUser.findFirst({ where: { id: payload.adminId, isActive: true } });
  if (!admin || admin.username !== payload.username || !isAdminRole(admin.role)) {
    throw new AppError('Потрібна авторизація адміністратора', 401);
  }
  return { adminId: admin.id, username: admin.username, role: validateRole(admin.role), department: admin.department, unit: admin.unit, mustChangePassword: admin.mustChangePassword };
}

function checkIpRateLimit(ipAddress?: string) {
  const ip = ipAddress || 'unknown';
  const now = Date.now();
  const attempts = (ipLoginAttempts.get(ip) ?? []).filter((time) => now - time < IP_WINDOW_MS);
  attempts.push(now);
  ipLoginAttempts.set(ip, attempts);
  if (attempts.length > MAX_IP_ATTEMPTS) throw new AppError('Забагато спроб входу. Спробуйте пізніше.', 429);
}

async function auditLoginFailure(username: string, metadata: RequestMetadata, details = 'Невірний логін або пароль') {
  await createAuditLog({ action: 'Невдалий admin login', entityType: 'admin', details: `${username}; ${details}`, ...metadata });
}

export async function loginAdmin(usernameValue: unknown, passwordValue: unknown, metadata: RequestMetadata = {}) {
  checkIpRateLimit(metadata.ipAddress);
  const username = required(usernameValue, 'Логін адміністратора обов’язковий.');
  const password = required(passwordValue, 'Пароль адміністратора обов’язковий.');
  const admin = await prisma.adminUser.findUnique({ where: { username } });
  if (!admin) {
    await auditLoginFailure(username, metadata);
    throw new AppError('Невірний логін або пароль', 401);
  }
  if (!admin.isActive) {
    await auditLoginFailure(username, metadata, 'Неактивний обліковий запис');
    throw new AppError('Обліковий запис адміністратора неактивний', 403);
  }
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    await auditLoginFailure(username, metadata, 'Обліковий запис тимчасово заблоковано');
    throw new AppError('Обліковий запис тимчасово заблоковано через невдалі спроби входу. Спробуйте пізніше.', 423);
  }
  if (!await bcrypt.compare(password, admin.passwordHash)) {
    const failedLoginAttempts = admin.failedLoginAttempts + 1;
    const lockedUntil = failedLoginAttempts >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
      : null;
    await prisma.adminUser.update({ where: { id: admin.id }, data: { failedLoginAttempts, lockedUntil } });
    await auditLoginFailure(username, metadata);
    if (lockedUntil) {
      await createAuditLog({
        action: 'Admin account locked',
        entityType: 'admin',
        entityId: admin.id,
        details: username,
        targetAdminId: admin.id,
        targetRole: validateRole(admin.role),
        targetDepartment: admin.department,
        ...metadata,
      });
    }
    throw new AppError('Невірний логін або пароль', 401);
  }
  const role = validateRole(admin.role);
  const loggedIn = await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: metadata.ipAddress ?? null,
    },
  });
  const temporaryToken = pendingAdminToken(loggedIn);
  await createAuditLog({
    action: `Успішний admin password login: ${role}`,
    entityType: 'admin',
    entityId: admin.id,
    details: admin.username,
    actorAdminId: admin.id,
    actorUsername: admin.username,
    actorRole: role,
    actorDepartment: admin.department,
    ...metadata,
  });
  if (loggedIn.mustChangePassword) {
    return { mustChangePassword: true, requiresTwoFactor: false, temporaryToken, admin: publicAdmin({ ...loggedIn, role }) };
  }
  if (!loggedIn.twoFactorEnabled) {
    return { requiresTwoFactorSetup: true, temporaryToken, admin: publicAdmin({ ...loggedIn, role }) };
  }
  return { requiresTwoFactor: true, temporaryToken, admin: publicAdmin({ ...loggedIn, role }) };
}

export async function getMyAdminProfile(actor: AdminTokenPayload) {
  const admin = await prisma.adminUser.findUnique({ where: { id: actor.adminId } });
  if (!admin) throw new AppError('Адміністратора не знайдено.', 404);
  return publicAdmin({ ...admin, role: validateRole(admin.role) });
}

export async function changeOwnPassword(actor: AdminTokenPayload, input: Record<string, unknown>, metadata: RequestMetadata = {}) {
  const currentPassword = required(input.currentPassword, 'Поточний пароль обов’язковий.');
  const newPassword = validatePasswordPolicy(input.newPassword);
  const confirmPassword = required(input.confirmPassword, 'Повторіть новий пароль.');
  if (newPassword !== confirmPassword) throw new AppError('Новий пароль і повторення не збігаються.', 400);
  const admin = await prisma.adminUser.findUnique({ where: { id: actor.adminId } });
  if (!admin) throw new AppError('Адміністратора не знайдено.', 404);
  if (!await bcrypt.compare(currentPassword, admin.passwordHash)) throw new AppError('Поточний пароль неправильний.', 400);
  if (await bcrypt.compare(newPassword, admin.passwordHash)) throw new AppError('Новий пароль не може збігатися зі старим.', 400);
  const updated = await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 10),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  await createAuditLog({
    action: admin.mustChangePassword ? 'Forced password change completed' : 'Admin password changed by self',
    entityType: 'admin',
    entityId: admin.id,
    details: admin.username,
    ...actorMetadata(actor, metadata),
  });
  return publicAdmin(updated);
}

export async function changePasswordWithPendingToken(pending: AdminTwoFactorPendingPayload, input: Record<string, unknown>, metadata: RequestMetadata = {}) {
  return changeOwnPassword({
    adminId: pending.adminId,
    username: pending.username,
    role: pending.role,
    department: pending.department,
    mustChangePassword: pending.mustChangePassword,
  }, input, metadata);
}

export async function setupTwoFactor(pending: AdminTwoFactorPendingPayload, metadata: RequestMetadata = {}) {
  const admin = await prisma.adminUser.findUnique({ where: { id: pending.adminId } });
  if (!admin) throw new AppError('Адміністратора не знайдено.', 404);
  if (admin.twoFactorEnabled) throw new AppError('Двофакторна автентифікація вже увімкнена.', 400);
  const secret = generateSecret();
  const issuer = 'Електронний маршрутний лист';
  const accountName = admin.username;
  await prisma.adminUser.update({ where: { id: admin.id }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });
  const otpauth = generateURI({ issuer, label: accountName, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
  await createAuditLog({
    action: '2FA setup started',
    entityType: 'admin',
    entityId: admin.id,
    details: admin.username,
    actorAdminId: admin.id,
    actorUsername: admin.username,
    actorRole: validateRole(admin.role),
    actorDepartment: admin.department,
    ...metadata,
  });
  return { qrCodeDataUrl, manualEntryKey: secret, issuer, accountName };
}

async function handleTwoFactorFailure(admin: { id: string; username: string; role: string; department: string | null; failedLoginAttempts: number }, metadata: RequestMetadata) {
  const failedLoginAttempts = admin.failedLoginAttempts + 1;
  const lockedUntil = failedLoginAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null;
  await prisma.adminUser.update({ where: { id: admin.id }, data: { failedLoginAttempts, lockedUntil } });
  await createAuditLog({
    action: '2FA login failed',
    entityType: 'admin',
    entityId: admin.id,
    details: admin.username,
    actorAdminId: admin.id,
    actorUsername: admin.username,
    actorRole: validateRole(admin.role),
    actorDepartment: admin.department,
    ...metadata,
  });
  if (lockedUntil) {
    await createAuditLog({
      action: 'admin locked due to failed 2FA attempts',
      entityType: 'admin',
      entityId: admin.id,
      details: admin.username,
      targetAdminId: admin.id,
      targetRole: validateRole(admin.role),
      targetDepartment: admin.department,
      ...metadata,
    });
    throw new AppError('Забагато неправильних кодів. Обліковий запис тимчасово заблоковано.', 423);
  }
  throw new AppError('Невірний код автентифікатора', 401);
}

export async function enableTwoFactor(pending: AdminTwoFactorPendingPayload, input: Record<string, unknown>, metadata: RequestMetadata = {}) {
  const code = required(input.code, 'Код автентифікатора обов’язковий.');
  const admin = await prisma.adminUser.findUnique({ where: { id: pending.adminId } });
  if (!admin) throw new AppError('Адміністратора не знайдено.', 404);
  if (!admin.twoFactorSecret) throw new AppError('Спочатку почніть налаштування 2FA.', 400);
  if (admin.lockedUntil && admin.lockedUntil > new Date()) throw new AppError('Обліковий запис тимчасово заблоковано через невдалі спроби входу. Спробуйте пізніше.', 423);
  if (!(await verify({ secret: admin.twoFactorSecret, token: code })).valid) await handleTwoFactorFailure(admin, metadata);
  const updated = await prisma.adminUser.update({
    where: { id: admin.id },
    data: { twoFactorEnabled: true, twoFactorEnabledAt: new Date(), twoFactorLastVerifiedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
  });
  await createAuditLog({
    action: '2FA enabled',
    entityType: 'admin',
    entityId: admin.id,
    details: admin.username,
    actorAdminId: admin.id,
    actorUsername: admin.username,
    actorRole: validateRole(admin.role),
    actorDepartment: admin.department,
    ...metadata,
  });
  return { token: fullAdminToken(updated), admin: publicAdmin({ ...updated, role: validateRole(updated.role) }) };
}

export async function verifyTwoFactorLogin(pending: AdminTwoFactorPendingPayload, input: Record<string, unknown>, metadata: RequestMetadata = {}) {
  const code = required(input.code, 'Код автентифікатора обов’язковий.');
  const admin = await prisma.adminUser.findUnique({ where: { id: pending.adminId } });
  if (!admin) throw new AppError('Адміністратора не знайдено.', 404);
  if (!admin.twoFactorEnabled || !admin.twoFactorSecret) throw new AppError('Двофакторна автентифікація ще не налаштована.', 400);
  if (admin.lockedUntil && admin.lockedUntil > new Date()) throw new AppError('Обліковий запис тимчасово заблоковано через невдалі спроби входу. Спробуйте пізніше.', 423);
  if (!(await verify({ secret: admin.twoFactorSecret, token: code })).valid) await handleTwoFactorFailure(admin, metadata);
  const updated = await prisma.adminUser.update({
    where: { id: admin.id },
    data: { twoFactorLastVerifiedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
  });
  await createAuditLog({
    action: '2FA login success',
    entityType: 'admin',
    entityId: admin.id,
    details: admin.username,
    actorAdminId: admin.id,
    actorUsername: admin.username,
    actorRole: validateRole(admin.role),
    actorDepartment: admin.department,
    ...metadata,
  });
  return { token: fullAdminToken(updated), admin: publicAdmin({ ...updated, role: validateRole(updated.role) }) };
}

export async function logoutAdmin(actor: AdminTokenPayload, metadata: RequestMetadata = {}) {
  await createAuditLog({
    action: 'Admin logout',
    entityType: 'admin',
    entityId: actor.adminId,
    details: actor.username,
    ...actorMetadata(actor, metadata),
  });
}

export async function listAdminUsers(actor: AdminTokenPayload) {
  const where: Prisma.AdminUserWhereInput = actor.role === 'SYSTEM_OWNER' ? {} : { role: 'REGIONAL_ADMIN' };
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
  const unit = role === 'REGIONAL_ADMIN' ? optionalText(input.unit) : null;
  const password = validatePasswordPolicy(input.password);
  try {
    const admin = await prisma.adminUser.create({
      data: {
        username,
        fullName,
        role,
        department,
        unit,
        passwordHash: await bcrypt.hash(password, 10),
        isActive: input.isActive !== false,
        mustChangePassword: true,
        passwordChangedAt: null,
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
      targetUnit: unit,
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
  try {
    const admin = await prisma.adminUser.update({
      where: { id },
      data: {
        username: input.username === undefined ? undefined : required(input.username, 'Логін обов’язковий.'),
        fullName: input.fullName === undefined ? undefined : required(input.fullName, 'ПІБ обов’язкове.'),
        role: nextRole,
        department: input.department === undefined && nextRole === currentRole ? undefined : validateDepartment(nextRole, input.department ?? current.department),
        unit: nextRole === 'REGIONAL_ADMIN' ? input.unit === undefined ? undefined : optionalText(input.unit) : null,
        isActive: input.isActive === undefined ? undefined : Boolean(input.isActive),
      },
    });
    await createAuditLog({
      action: 'Адміністратора оновлено',
      entityType: 'admin',
      entityId: admin.id,
      details: admin.username,
      targetAdminId: admin.id,
      targetRole: validateRole(admin.role),
      targetDepartment: admin.department,
      targetUnit: admin.unit,
      ...actorMetadata(actor, metadata),
    });
    return publicAdmin(admin);
  } catch (error) { uniqueAdminError(error); }
}

export async function resetAdminPassword(actor: AdminTokenPayload, id: string, input: Record<string, unknown>, metadata: RequestMetadata = {}) {
  const current = await prisma.adminUser.findUnique({ where: { id } });
  if (!current) throw new AppError('Адміністратора не знайдено.', 404);
  const currentRole = validateRole(current.role);
  if (currentRole === 'SYSTEM_OWNER') throw new AppError(OWNER_LOCK_MESSAGE, 403);
  ensureCanManageTarget(actor, currentRole);
  const newTemporaryPassword = validatePasswordPolicy(input.newTemporaryPassword);
  const updated = await prisma.adminUser.update({
    where: { id },
    data: {
      passwordHash: await bcrypt.hash(newTemporaryPassword, 10),
      mustChangePassword: true,
      passwordChangedAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  await createAuditLog({
    action: 'Admin password reset by SYSTEM_OWNER/NATIONAL_ADMIN',
    entityType: 'admin',
    entityId: updated.id,
    details: updated.username,
    targetAdminId: updated.id,
    targetRole: currentRole,
    targetDepartment: updated.department,
    ...actorMetadata(actor, metadata),
  });
  return publicAdmin(updated);
}

export async function resetAdminTwoFactor(actor: AdminTokenPayload, id: string, metadata: RequestMetadata = {}) {
  if (actor.role !== 'SYSTEM_OWNER') throw new AppError('Скинути 2FA може тільки власник системи.', 403);
  if (actor.adminId === id) throw new AppError('Неможливо скинути власну 2FA через адміністративну панель.', 400);
  const current = await prisma.adminUser.findUnique({ where: { id } });
  if (!current) throw new AppError('Адміністратора не знайдено.', 404);
  const currentRole = validateRole(current.role);
  if (currentRole === 'SYSTEM_OWNER') throw new AppError(OWNER_LOCK_MESSAGE, 403);
  const updated = await prisma.adminUser.update({
    where: { id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      twoFactorLastVerifiedAt: null,
      twoFactorRecoveryCodesHash: null,
      mustChangePassword: true,
    },
  });
  await createAuditLog({
    action: '2FA reset by SYSTEM_OWNER',
    entityType: 'admin',
    entityId: updated.id,
    details: updated.username,
    targetAdminId: updated.id,
    targetRole: currentRole,
    targetDepartment: updated.department,
    ...actorMetadata(actor, metadata),
  });
  return publicAdmin(updated);
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
