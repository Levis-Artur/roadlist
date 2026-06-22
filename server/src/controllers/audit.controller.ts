import type { NextFunction, Request, Response } from 'express';
import { createAuditLog, listAuditLogs } from '../services/audit.service.js';

export async function listAuditLogsController(_request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, auditLogs: await listAuditLogs() });
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
    });
    response.status(201).json({ success: true, auditLog });
  } catch (error) { next(error); }
}
