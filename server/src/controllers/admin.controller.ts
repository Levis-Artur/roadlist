import type { NextFunction, Request, Response } from 'express';
import {
  changeOwnPassword,
  changePasswordWithPendingToken,
  createAdminUser,
  deactivateAdminUser,
  enableTwoFactor,
  getMyAdminProfile,
  listAdminUsers,
  loginAdmin,
  logoutAdmin,
  recoverAdminAccess,
  resetAdminPassword,
  resetAdminTwoFactor,
  setupTwoFactor,
  updateAdminUser,
  verifyAdminToken,
  verifyPendingToken,
  verifyTwoFactorLogin,
} from '../services/admin.service.js';

export function metadata(request: Request) {
  return { ipAddress: request.ip, userAgent: request.get('user-agent') };
}

function bearerToken(request: Request) {
  const authorization = request.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

export async function loginAdminController(request: Request, response: Response, next: NextFunction) {
  try {
    const result = await loginAdmin(request.body?.username, request.body?.password, metadata(request));
    response.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function listAdminUsersController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, admins: await listAdminUsers(request.admin!) });
  } catch (error) { next(error); }
}

export async function getMyAdminProfileController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, admin: await getMyAdminProfile(request.admin!) });
  } catch (error) { next(error); }
}

export async function changeOwnPasswordController(request: Request, response: Response, next: NextFunction) {
  try {
    let pending;
    try { pending = verifyPendingToken(bearerToken(request)); } catch { pending = undefined; }
    if (pending) await changePasswordWithPendingToken(pending, request.body ?? {}, metadata(request));
    else await changeOwnPassword(await verifyAdminToken(bearerToken(request)), request.body ?? {}, metadata(request));
    response.json({ success: true, message: 'Пароль змінено. Увійдіть повторно.' });
  } catch (error) { next(error); }
}

export async function setupTwoFactorController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, ...await setupTwoFactor(verifyPendingToken(bearerToken(request)), metadata(request)) });
  } catch (error) { next(error); }
}

export async function enableTwoFactorController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, ...await enableTwoFactor(verifyPendingToken(bearerToken(request)), request.body ?? {}, metadata(request)) });
  } catch (error) { next(error); }
}

export async function verifyTwoFactorController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, ...await verifyTwoFactorLogin(verifyPendingToken(bearerToken(request)), request.body ?? {}, metadata(request)) });
  } catch (error) { next(error); }
}

export async function logoutAdminController(request: Request, response: Response, next: NextFunction) {
  try {
    await logoutAdmin(request.admin!, metadata(request));
    response.json({ success: true, message: 'Вихід виконано' });
  } catch (error) { next(error); }
}

export async function createAdminUserController(request: Request, response: Response, next: NextFunction) {
  try {
    response.status(201).json({ success: true, admin: await createAdminUser(request.admin!, request.body ?? {}, metadata(request)) });
  } catch (error) { next(error); }
}

export async function updateAdminUserController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, admin: await updateAdminUser(request.admin!, request.params.id, request.body ?? {}, metadata(request)) });
  } catch (error) { next(error); }
}

export async function resetAdminPasswordController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, ...await resetAdminPassword(request.admin!, request.params.id, request.body ?? {}, metadata(request)) });
  } catch (error) { next(error); }
}

export async function resetAdminTwoFactorController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, ...await resetAdminTwoFactor(request.admin!, request.params.id, metadata(request)) });
  } catch (error) { next(error); }
}

export async function recoverAdminAccessController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, ...await recoverAdminAccess(request.admin!, request.params.id, request.body ?? {}, metadata(request)) });
  } catch (error) { next(error); }
}

export async function deactivateAdminUserController(request: Request, response: Response, next: NextFunction) {
  try {
    await deactivateAdminUser(request.admin!, request.params.id, request.body ?? {}, metadata(request));
    response.json({ success: true, message: 'Адміністратора видалено' });
  } catch (error) { next(error); }
}
