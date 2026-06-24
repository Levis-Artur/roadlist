import { Router } from 'express';
import {
  finishShiftController,
  getRouteSheetController,
  deleteRouteSheetController,
  listMyActiveRouteSheetsController,
  listRouteSheetsController,
  markRouteSheetNeedsReviewController,
  startShiftController,
  updateRouteSheetAdminCommentController,
  verifyRouteSheetController,
} from '../controllers/routeSheet.controller.js';
import { authOfficer } from '../middleware/authOfficer.js';
import { authAdmin } from '../middleware/authAdmin.js';

export const routeSheetRouter = Router();
routeSheetRouter.post('/start', authOfficer, startShiftController);
routeSheetRouter.post('/finish', authOfficer, finishShiftController);
routeSheetRouter.get('/active/me', authOfficer, listMyActiveRouteSheetsController);
routeSheetRouter.get('/', authAdmin, listRouteSheetsController);
routeSheetRouter.post('/:id/verify', authAdmin, verifyRouteSheetController);
routeSheetRouter.post('/:id/mark-needs-review', authAdmin, markRouteSheetNeedsReviewController);
routeSheetRouter.patch('/:id/admin-comment', authAdmin, updateRouteSheetAdminCommentController);
routeSheetRouter.get('/:id', authAdmin, getRouteSheetController);
routeSheetRouter.delete('/:id', authAdmin, deleteRouteSheetController);
