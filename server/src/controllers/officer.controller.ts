import type { NextFunction, Request, Response } from 'express';
import {
  createOfficer,
  deactivateOfficer,
  listOfficersScoped,
  loginOfficer,
  logoutOfficer,
  updateOfficer,
  verifyOfficer,
} from '../services/officer.service.js';

function metadata(request: Request) {
  return {
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
    actorAdminId: request.admin?.adminId,
    actorUsername: request.admin?.username,
    actorRole: request.admin?.role,
    actorDepartment: request.admin?.department ?? null,
    actorUnit: request.admin?.unit ?? null,
  };
}

export async function loginOfficerController(request: Request, response: Response, next: NextFunction) {
  try {
    const result = await loginOfficer(request.body?.badgeNumber, request.body?.pin, metadata(request));
    response.json({ success: true, ...result });
  } catch (error) { next(error); }
}

export async function logoutOfficerController(request: Request, response: Response, next: NextFunction) {
  try {
    await logoutOfficer(request.officer!.badgeNumber, metadata(request));
    response.json({ success: true, message: 'Вихід виконано' });
  } catch (error) { next(error); }
}

export async function listOfficersController(request: Request, response: Response, next: NextFunction) {
  try {
    const officers = await listOfficersScoped(request.query, request.admin);
    response.json({ success: true, officers: Array.isArray(officers) ? officers : [] });
  } catch (error) { next(error); }
}

export async function createOfficerController(request: Request, response: Response, next: NextFunction) {
  try {
    response.status(201).json({ success: true, officer: await createOfficer(request.body ?? {}, metadata(request), request.admin) });
  } catch (error) { next(error); }
}

export async function updateOfficerController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, officer: await updateOfficer(request.params.id, request.body ?? {}, metadata(request), request.admin) });
  } catch (error) { next(error); }
}

export async function deactivateOfficerController(request: Request, response: Response, next: NextFunction) {
  try {
    await deactivateOfficer(request.params.id, metadata(request), request.admin);
    response.json({ success: true, message: 'Патрульного деактивовано' });
  } catch (error) { next(error); }
}

export async function verifyOfficerController(request: Request, response: Response, next: NextFunction) {
  try {
    const badgeNumber = typeof request.body?.badgeNumber === 'string' ? request.body.badgeNumber : '';
    const officer = await verifyOfficer(badgeNumber, metadata(request));
    if (!officer) {
      response.status(404).json({ success: false, message: 'Працівника з таким номером жетона не знайдено' });
      return;
    }
    response.json({ success: true, officer });
  } catch (error) {
    next(error);
  }
}
