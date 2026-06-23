import { Router } from 'express';
import {
  createAdminUserController,
  changeOwnPasswordController,
  deactivateAdminUserController,
  enableTwoFactorController,
  getMyAdminProfileController,
  listAdminUsersController,
  loginAdminController,
  logoutAdminController,
  resetAdminPasswordController,
  resetAdminTwoFactorController,
  setupTwoFactorController,
  updateAdminUserController,
  verifyTwoFactorController,
} from '../controllers/admin.controller.js';
import { authAdmin, requireAdminManager } from '../middleware/authAdmin.js';

export const adminRouter = Router();
adminRouter.post('/login', loginAdminController);
adminRouter.post('/change-password', changeOwnPasswordController);
adminRouter.post('/2fa/setup', setupTwoFactorController);
adminRouter.post('/2fa/enable', enableTwoFactorController);
adminRouter.post('/2fa/verify', verifyTwoFactorController);
adminRouter.post('/logout', authAdmin, logoutAdminController);
adminRouter.get('/me', authAdmin, getMyAdminProfileController);
adminRouter.get('/users', authAdmin, requireAdminManager, listAdminUsersController);
adminRouter.post('/users', authAdmin, requireAdminManager, createAdminUserController);
adminRouter.patch('/users/:id/password', authAdmin, requireAdminManager, resetAdminPasswordController);
adminRouter.post('/users/:id/2fa/reset', authAdmin, requireAdminManager, resetAdminTwoFactorController);
adminRouter.post('/:id/2fa/reset', authAdmin, requireAdminManager, resetAdminTwoFactorController);
adminRouter.patch('/:id/password', authAdmin, requireAdminManager, resetAdminPasswordController);
adminRouter.patch('/users/:id', authAdmin, requireAdminManager, updateAdminUserController);
adminRouter.delete('/users/:id', authAdmin, requireAdminManager, deactivateAdminUserController);
