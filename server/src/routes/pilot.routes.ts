import { Router } from 'express';
import { getPilotStatusController } from '../controllers/pilot.controller.js';

export const pilotRouter = Router();
pilotRouter.get('/status', getPilotStatusController);
