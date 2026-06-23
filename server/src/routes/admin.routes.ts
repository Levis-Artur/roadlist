import { Router } from 'express';
import {
  createAdminUserController,
  deactivateAdminUserController,
  listAdminUsersController,
  loginAdminController,
  updateAdminUserController,
} from '../controllers/admin.controller.js';
import { authAdmin, requireAdminManager } from '../middleware/authAdmin.js';

export const adminRouter = Router();
adminRouter.post('/login', loginAdminController);
adminRouter.get('/users', authAdmin, requireAdminManager, listAdminUsersController);
adminRouter.post('/users', authAdmin, requireAdminManager, createAdminUserController);
adminRouter.patch('/users/:id', authAdmin, requireAdminManager, updateAdminUserController);
adminRouter.delete('/users/:id', authAdmin, requireAdminManager, deactivateAdminUserController);
