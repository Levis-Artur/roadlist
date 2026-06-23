import { prisma } from '../config/prisma.js';
import type { AdminTokenPayload, AuditLogInput } from '../types/index.js';

export async function createAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({ data: input });
}

export async function listAuditLogs(actor?: AdminTokenPayload) {
  return prisma.auditLog.findMany({
    where: actor?.role === 'REGIONAL_ADMIN'
      ? {
          OR: [
            { actorDepartment: actor.department ?? '' },
            { targetDepartment: actor.department ?? '' },
            { details: { contains: actor.department ?? '', mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
  });
}
