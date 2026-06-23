import { Router } from 'express';
import {
  createOfficerController,
  deactivateOfficerController,
  listOfficersController,
  loginOfficerController,
  logoutOfficerController,
  updateOfficerController,
  verifyOfficerController,
} from '../controllers/officer.controller.js';
import { authOfficer } from '../middleware/authOfficer.js';
import { authAdmin } from '../middleware/authAdmin.js';

export const officerRouter = Router();
officerRouter.post('/verify', verifyOfficerController);
officerRouter.post('/login', loginOfficerController);
officerRouter.post('/logout', authOfficer, logoutOfficerController);
officerRouter.get('/', authAdmin, listOfficersController);
officerRouter.post('/', authAdmin, createOfficerController);
officerRouter.patch('/:id', authAdmin, updateOfficerController);
officerRouter.delete('/:id', authAdmin, deactivateOfficerController);
