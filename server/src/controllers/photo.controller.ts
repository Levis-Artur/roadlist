import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs/promises';
import { AppError } from '../middleware/errorHandler.js';
import { getAvailablePhoto, recognizePhoto, saveUploadedPhoto } from '../services/photo.service.js';
import type { PhotoType } from '../types/index.js';

function parsePhotoType(value: unknown): PhotoType {
  if (value !== 'start' && value !== 'end') throw new AppError('Тип фото має бути start або end.', 400);
  return value;
}

export async function uploadPhotoController(request: Request, response: Response, next: NextFunction) {
  try {
    if (!request.file) throw new AppError('Додайте файл фото.', 400);
    const photo = await saveUploadedPhoto(request.file, parsePhotoType(request.body?.type), {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
    response.status(201).json({ success: true, photoId: photo.id });
  } catch (error) {
    if (request.file) await fs.unlink(request.file.path).catch(() => undefined);
    next(error);
  }
}

export async function getPhotoController(request: Request, response: Response, next: NextFunction) {
  try {
    const photo = await getAvailablePhoto(request.params.id);
    if (!photo) {
      response.status(404).json({ success: false, message: 'Фото недоступне або було видалене' });
      return;
    }
    response.type(photo.mimeType).sendFile(photo.filePath);
  } catch (error) {
    next(error);
  }
}

export async function recognizePhotoController(request: Request, response: Response, next: NextFunction) {
  try {
    const value = await recognizePhoto(request.params.id, parsePhotoType(request.body?.type));
    response.json({ success: true, value });
  } catch (error) {
    next(error);
  }
}
