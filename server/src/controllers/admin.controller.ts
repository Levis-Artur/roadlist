import type { NextFunction, Request, Response } from 'express';
import { loginAdmin } from '../services/admin.service.js';

export async function loginAdminController(request: Request, response: Response, next: NextFunction) {
  try {
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    const success = await loginAdmin(password, { ipAddress: request.ip, userAgent: request.get('user-agent') });
    if (!success) {
      response.status(401).json({ success: false, message: 'Невірний пароль адміністратора' });
      return;
    }
    response.json({ success: true, token: 'mock-admin-token' });
  } catch (error) {
    next(error);
  }
}
