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

export const officerRouter = Router();
officerRouter.post('/verify', verifyOfficerController);
officerRouter.post('/login', loginOfficerController);
officerRouter.post('/logout', authOfficer, logoutOfficerController);
officerRouter.get('/', listOfficersController);
officerRouter.post('/', createOfficerController);
officerRouter.patch('/:id', updateOfficerController);
officerRouter.delete('/:id', deactivateOfficerController);
