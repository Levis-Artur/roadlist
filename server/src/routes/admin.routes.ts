import { Router } from 'express';
import { loginAdminController } from '../controllers/admin.controller.js';

export const adminRouter = Router();
adminRouter.post('/login', loginAdminController);
