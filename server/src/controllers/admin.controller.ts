import type { NextFunction, Request, Response } from 'express';
import { createAdminUser, deactivateAdminUser, listAdminUsers, loginAdmin, updateAdminUser } from '../services/admin.service.js';

export function metadata(request: Request) {
  return { ipAddress: request.ip, userAgent: request.get('user-agent') };
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

export async function deactivateAdminUserController(request: Request, response: Response, next: NextFunction) {
  try {
    await deactivateAdminUser(request.admin!, request.params.id, metadata(request));
    response.json({ success: true, message: 'Адміністратора деактивовано' });
  } catch (error) { next(error); }
}
