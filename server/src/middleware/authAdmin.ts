import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import type { AdminRole, AdminTokenPayload } from '../types/index.js';
import { createAuditLog } from '../services/audit.service.js';

const ADMIN_ROLES: AdminRole[] = ['SYSTEM_OWNER', 'NATIONAL_ADMIN', 'REGIONAL_ADMIN'];

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && ADMIN_ROLES.includes(value as AdminRole);
}

export function canManageAdmins(role: AdminRole): boolean {
  return role === 'SYSTEM_OWNER' || role === 'NATIONAL_ADMIN';
}

export function isGlobalAdmin(role: AdminRole): boolean {
  return role === 'SYSTEM_OWNER' || role === 'NATIONAL_ADMIN';
}

export async function authAdmin(request: Request, response: Response, next: NextFunction) {
  const authorization = request.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  try {
    if (!token) throw new Error('missing token');
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload & AdminTokenPayload;
    if (!payload.adminId || !payload.username || !isAdminRole(payload.role)) throw new Error('invalid token');
    const admin = await prisma.adminUser.findFirst({
      where: { id: payload.adminId, isActive: true },
      select: { id: true, username: true, role: true, department: true, unit: true, mustChangePassword: true, twoFactorEnabled: true },
    });
    if (!admin || admin.username !== payload.username || !isAdminRole(admin.role)) throw new Error('inactive admin');
    request.admin = {
      adminId: admin.id,
      username: admin.username,
      role: admin.role,
      department: admin.department,
      unit: admin.unit,
      mustChangePassword: admin.mustChangePassword,
    };
    if (admin.mustChangePassword && request.path !== '/change-password' && request.path !== '/logout') {
      response.status(403).json({ success: false, message: 'Потрібно змінити тимчасовий пароль.' });
      return;
    }
    if (!admin.twoFactorEnabled && request.path !== '/logout') {
      response.status(403).json({ success: false, message: 'Потрібно налаштувати двофакторну автентифікацію.' });
      return;
    }
    next();
  } catch {
    await createAuditLog({
      action: 'Expired session / unauthorized admin access attempt',
      entityType: 'admin',
      details: request.path,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    }).catch(() => undefined);
    response.status(401).json({ success: false, message: 'Потрібна авторизація адміністратора' });
  }
}

export function requireAdminManager(request: Request, response: Response, next: NextFunction) {
  if (!request.admin || !canManageAdmins(request.admin.role)) {
    response.status(403).json({ success: false, message: 'Недостатньо прав для керування адміністраторами' });
    return;
  }
  next();
}
