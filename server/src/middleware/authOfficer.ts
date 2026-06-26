import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

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

export async function authOfficer(request: Request, response: Response, next: NextFunction) {
  const authorization = request.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  try {
    if (!token) throw new Error('missing token');
    const payload = jwt.verify(token, env.jwtSecret) as OfficerTokenPayload;
    if (!payload.badgeNumber || !payload.fullName || !payload.department) throw new Error('invalid token');
    const officer = await prisma.officer.findFirst({
      where: { badgeNumber: payload.badgeNumber, isActive: true, isDeleted: false },
      select: {
        badgeNumber: true,
        fullName: true,
        department: true,
        unit: true,
        departmentId: true,
        departmentName: true,
        departmentUnitId: true,
        departmentUnitName: true,
      },
    });
    if (!officer || officer.fullName !== payload.fullName) throw new Error('inactive officer');
    request.officer = {
      badgeNumber: officer.badgeNumber,
      fullName: officer.fullName,
      department: officer.department,
      unit: officer.unit ?? null,
      departmentId: officer.departmentId ?? null,
      departmentName: officer.departmentName ?? officer.department,
      departmentUnitId: officer.departmentUnitId ?? null,
      departmentUnitName: officer.departmentUnitName ?? officer.unit ?? null,
    };
    next();
  } catch {
    response.status(401).json({ success: false, message: 'Потрібна авторизація патрульного' });
  }
}
