import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs/promises';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAvailablePhotoWithRouteSheet, recognizePhoto, saveUploadedPhoto } from '../services/photo.service.js';
import { verifyAdminToken } from '../services/admin.service.js';
import type { AdminTokenPayload, PhotoType } from '../types/index.js';

function parsePhotoType(value: unknown): PhotoType {
  if (value !== 'start' && value !== 'end') throw new AppError('Тип фото має бути start або end.', 400);
  return value;
}

function bearerToken(request: Request): string {
  const authorization = request.get('authorization');
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
}

async function verifyOfficerToken(token: string) {
  const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload & { badgeNumber?: string; department?: string; departmentId?: string | null };
  if (!payload.badgeNumber || !payload.department) throw new Error('invalid officer token');
  const officer = await prisma.officer.findFirst({
    where: { badgeNumber: payload.badgeNumber, isActive: true, isDeleted: false },
    select: { badgeNumber: true, department: true, departmentId: true, departmentName: true },
  });
  if (!officer) throw new Error('inactive officer');
  return officer;
}

async function resolvePhotoActor(request: Request): Promise<{ admin?: AdminTokenPayload; officer?: { badgeNumber: string; department: string; departmentId?: string | null } }> {
  const token = bearerToken(request);
  if (!token) throw new AppError('Потрібна авторизація для перегляду фото.', 401);
  try {
    return { admin: await verifyAdminToken(token) };
  } catch {
    try {
      const officer = await verifyOfficerToken(token);
      return { officer: { badgeNumber: officer.badgeNumber, department: officer.departmentName ?? officer.department, departmentId: officer.departmentId ?? null } };
    } catch {
      throw new AppError('Потрібна авторизація для перегляду фото.', 401);
    }
  }
}

type PhotoWithRouteSheet = NonNullable<Awaited<ReturnType<typeof getAvailablePhotoWithRouteSheet>>>;

function assertPhotoAccess(actor: { admin?: AdminTokenPayload; officer?: { badgeNumber: string; department: string; departmentId?: string | null } }, photo: PhotoWithRouteSheet) {
  if (actor.admin) {
    if (actor.admin.role === 'SYSTEM_OWNER' || actor.admin.role === 'NATIONAL_ADMIN') return;
    const sameDepartmentId = actor.admin.departmentId && photo.routeSheet?.departmentId && actor.admin.departmentId === photo.routeSheet.departmentId;
    const sameDepartmentName = photo.routeSheet?.department === (actor.admin.departmentName ?? actor.admin.department);
    if (sameDepartmentId || sameDepartmentName) return;
    throw new AppError('Фото недоступне або було видалене', 404);
  }

  if (actor.officer) {
    const ownsLinkedPhoto = photo.routeSheet?.badgeNumber === actor.officer.badgeNumber;
    const ownsPendingUpload = !photo.routeSheet && photo.uploadedByBadgeNumber === actor.officer.badgeNumber;
    if (ownsLinkedPhoto || ownsPendingUpload) return;
  }

  throw new AppError('Фото недоступне або було видалене', 404);
}

export async function uploadPhotoController(request: Request, response: Response, next: NextFunction) {
  try {
    if (!request.file) throw new AppError('Додайте файл фото.', 400);
    const photo = await saveUploadedPhoto(request.file, parsePhotoType(request.body?.type), {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    }, request.officer?.badgeNumber);
    response.status(201).json({ success: true, photoId: photo.id });
  } catch (error) {
    if (request.file) await fs.unlink(request.file.path).catch(() => undefined);
    next(error);
  }
}

export async function getPhotoController(request: Request, response: Response, next: NextFunction) {
  try {
    const actor = await resolvePhotoActor(request);
    const photo = await getAvailablePhotoWithRouteSheet(request.params.id);
    if (!photo) {
      response.status(404).json({ success: false, message: 'Фото недоступне або було видалене' });
      return;
    }
    assertPhotoAccess(actor, photo);
    response.type(photo.mimeType).sendFile(photo.filePath);
  } catch (error) {
    next(error);
  }
}

export async function recognizePhotoController(request: Request, response: Response, next: NextFunction) {
  try {
    const photo = await getAvailablePhotoWithRouteSheet(request.params.id);
    if (!photo) throw new AppError('Фото недоступне або було видалене', 404);
    assertPhotoAccess({ officer: request.officer }, photo);
    const value = await recognizePhoto(request.params.id, parsePhotoType(request.body?.type));
    response.json({ success: true, value });
  } catch (error) {
    next(error);
  }
}
