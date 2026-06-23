import { Router } from 'express';
import {
  closeMonthlyRouteSheetController,
  getMonthlyRouteSheetController,
  getMonthlyRouteSheetPrintDataController,
  listMonthlyRouteSheetsController,
  markMonthlyRouteSheetPrintedController,
  reopenMonthlyRouteSheetController,
} from '../controllers/monthlyRouteSheet.controller.js';

export const monthlyRouteSheetRouter = Router();

monthlyRouteSheetRouter.get('/', listMonthlyRouteSheetsController);
monthlyRouteSheetRouter.get('/:id/print-data', getMonthlyRouteSheetPrintDataController);
monthlyRouteSheetRouter.get('/:id', getMonthlyRouteSheetController);
monthlyRouteSheetRouter.post('/:id/close', closeMonthlyRouteSheetController);
monthlyRouteSheetRouter.post('/:id/reopen', reopenMonthlyRouteSheetController);
monthlyRouteSheetRouter.post('/:id/mark-printed', markMonthlyRouteSheetPrintedController);
