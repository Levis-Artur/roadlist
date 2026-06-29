import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';

export class AppError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const knownError = error instanceof AppError || error instanceof multer.MulterError;
  const statusCode = error instanceof AppError ? error.statusCode : error instanceof multer.MulterError ? 400 : 500;
  const uploadLimitMb = Math.max(1, Math.round(env.uploadMaxBytes / 1024 / 1024));
  const message = error instanceof AppError
    ? error.message
    : error instanceof multer.MulterError
      ? error.code === 'LIMIT_FILE_SIZE' ? `Розмір фото не може перевищувати ${uploadLimitMb} МБ.` : 'Не вдалося завантажити фото.'
      : 'Внутрішня помилка сервера';
  if (!knownError) console.error(error);
  response.status(statusCode).json({
    success: false,
    message,
  });
};
