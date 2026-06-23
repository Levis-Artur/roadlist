import { Router } from 'express';
import { createAuditLogController, listAuditLogsController } from '../controllers/audit.controller.js';
import { authAdmin } from '../middleware/authAdmin.js';

export const auditRouter = Router();
auditRouter.get('/', authAdmin, listAuditLogsController);
auditRouter.post('/', authAdmin, createAuditLogController);
