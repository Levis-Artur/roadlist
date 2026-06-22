import { prisma } from '../config/prisma.js';
import type { AuditLogInput } from '../types/index.js';

export async function createAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({ data: input });
}

export async function listAuditLogs() {
  return prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } });
}
