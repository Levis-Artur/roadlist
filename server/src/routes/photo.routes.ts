import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { getPhotoController, recognizePhotoController, uploadPhotoController } from '../controllers/photo.controller.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { createId } from '../utils/id.js';

fs.mkdirSync(env.uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: env.uploadDir,
    filename: (_request, file, callback) => {
      const extension = path.extname(file.originalname).toLocaleLowerCase() || '.jpg';
      callback(null, `${createId()}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new AppError('Дозволено завантажувати лише зображення.', 400));
      return;
    }
    callback(null, true);
  },
});

export const photoRouter = Router();
photoRouter.post('/upload', upload.single('photo'), uploadPhotoController);
photoRouter.get('/:id', getPhotoController);
photoRouter.post('/:id/ocr', recognizePhotoController);
