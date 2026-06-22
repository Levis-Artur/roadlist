import { Router } from 'express';
import { createAuditLogController, listAuditLogsController } from '../controllers/audit.controller.js';

export const auditRouter = Router();
auditRouter.get('/', listAuditLogsController);
auditRouter.post('/', createAuditLogController);
