import { Router } from 'express';
import {
  closeMonthlyRouteSheetController,
  deleteMonthlyRouteSheetController,
  getMonthlyRouteSheetController,
  getMonthlyRouteSheetPrintDataController,
  listMonthlyRouteSheetsController,
  markMonthlyRouteSheetPrintedController,
  reopenMonthlyRouteSheetController,
} from '../controllers/monthlyRouteSheet.controller.js';
import { authAdmin } from '../middleware/authAdmin.js';

export const monthlyRouteSheetRouter = Router();

monthlyRouteSheetRouter.get('/', authAdmin, listMonthlyRouteSheetsController);
monthlyRouteSheetRouter.get('/:id/print-data', authAdmin, getMonthlyRouteSheetPrintDataController);
monthlyRouteSheetRouter.get('/:id', authAdmin, getMonthlyRouteSheetController);
monthlyRouteSheetRouter.post('/:id/close', authAdmin, closeMonthlyRouteSheetController);
monthlyRouteSheetRouter.post('/:id/reopen', authAdmin, reopenMonthlyRouteSheetController);
monthlyRouteSheetRouter.post('/:id/mark-printed', authAdmin, markMonthlyRouteSheetPrintedController);
monthlyRouteSheetRouter.delete('/:id', authAdmin, deleteMonthlyRouteSheetController);
