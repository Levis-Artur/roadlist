import fs from 'node:fs/promises';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { PhotoType, RequestMetadata } from '../types/index.js';
import { createAuditLog } from './audit.service.js';

export async function saveUploadedPhoto(
  file: Express.Multer.File,
  type: PhotoType,
  metadata: RequestMetadata = {},
  uploadedByBadgeNumber?: string,
) {
  if (!file.mimetype.startsWith('image/')) {
    await fs.unlink(file.path).catch(() => undefined);
    throw new AppError('Дозволено завантажувати лише зображення.', 400);
  }
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const photo = await prisma.odometerPhoto.create({
    data: {
      uploadedByBadgeNumber,
      type,
      filePath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      expiresAt,
    },
  });
  await createAuditLog({ action: 'Фото збережено', entityType: 'photo', entityId: photo.id, details: `Тип: ${type}`, ...metadata });
  return photo;
}

export async function getAvailablePhoto(id: string) {
  const photo = await prisma.odometerPhoto.findFirst({ where: { id, deletedAt: null, isDeleted: false } });
  if (!photo) return null;
  if (photo.expiresAt.getTime() < Date.now()) {
    await prisma.odometerPhoto.update({ where: { id }, data: { deletedAt: new Date(), isDeleted: true } });
    await fs.unlink(photo.filePath).catch(() => undefined);
    return null;
  }
  return photo;
}

export async function getAvailablePhotoWithRouteSheet(id: string) {
  const photo = await prisma.odometerPhoto.findFirst({
    where: { id, deletedAt: null, isDeleted: false },
    include: { routeSheet: true },
  });
  if (!photo) return null;
  if (photo.expiresAt.getTime() < Date.now()) {
    await prisma.odometerPhoto.update({ where: { id }, data: { deletedAt: new Date(), isDeleted: true } });
    await fs.unlink(photo.filePath).catch(() => undefined);
    return null;
  }
  return photo;
}

export async function recognizePhoto(id: string, type: PhotoType) {
  const photo = await getAvailablePhoto(id);
  if (!photo) throw new AppError('Фото недоступне або було видалене', 404);
  return type === 'start' ? 198234 : 198376;
}
