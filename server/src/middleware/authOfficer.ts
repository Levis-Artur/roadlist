import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

interface OfficerTokenPayload extends jwt.JwtPayload {
  badgeNumber: string;
  fullName: string;
  department: string;
  unit?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentUnitId?: string | null;
  departmentUnitName?: string | null;
}

export function authOfficer(request: Request, response: Response, next: NextFunction) {
  const authorization = request.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  try {
    if (!token) throw new Error('missing token');
    const payload = jwt.verify(token, env.jwtSecret) as OfficerTokenPayload;
    if (!payload.badgeNumber || !payload.fullName || !payload.department) throw new Error('invalid token');
    request.officer = {
      badgeNumber: payload.badgeNumber,
      fullName: payload.fullName,
      department: payload.department,
      unit: payload.unit ?? null,
      departmentId: payload.departmentId ?? null,
      departmentName: payload.departmentName ?? payload.department,
      departmentUnitId: payload.departmentUnitId ?? null,
      departmentUnitName: payload.departmentUnitName ?? payload.unit ?? null,
    };
    next();
  } catch {
    response.status(401).json({ success: false, message: 'Потрібна авторизація патрульного' });
  }
}
