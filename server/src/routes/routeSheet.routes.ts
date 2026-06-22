import { Router } from 'express';
import {
  finishShiftController,
  getRouteSheetController,
  listRouteSheetsController,
  startShiftController,
} from '../controllers/routeSheet.controller.js';
import { authOfficer } from '../middleware/authOfficer.js';

export const routeSheetRouter = Router();
routeSheetRouter.post('/start', authOfficer, startShiftController);
routeSheetRouter.post('/finish', authOfficer, finishShiftController);
routeSheetRouter.get('/', listRouteSheetsController);
routeSheetRouter.get('/:id', getRouteSheetController);
