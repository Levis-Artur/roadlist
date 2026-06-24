import type { NextFunction, Request, Response } from 'express';
import { createAuditLog, listAuditLogs } from '../services/audit.service.js';

export async function listAuditLogsController(request: Request, response: Response, next: NextFunction) {
  try {
    const auditLogs = await listAuditLogs(request.admin);
    response.json({ success: true, auditLogs: Array.isArray(auditLogs) ? auditLogs : [] });
  } catch (error) {
    next(error);
  }
}

export async function createAuditLogController(request: Request, response: Response, next: NextFunction) {
  try {
    const input = request.body ?? {};
    const auditLog = await createAuditLog({
      action: String(input.action ?? ''),
      entityType: String(input.entityType ?? 'admin'),
      entityId: input.entityId ? String(input.entityId) : undefined,
      badgeNumber: input.badgeNumber ? String(input.badgeNumber) : undefined,
      details: input.details ? String(input.details) : undefined,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      actorAdminId: request.admin?.adminId,
      actorUsername: request.admin?.username,
      actorRole: request.admin?.role,
      actorDepartment: request.admin?.department ?? null,
      actorUnit: request.admin?.unit ?? null,
    });
    response.status(201).json({ success: true, auditLog });
  } catch (error) { next(error); }
}
