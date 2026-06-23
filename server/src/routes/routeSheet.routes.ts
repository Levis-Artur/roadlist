import { Router } from 'express';
import {
  finishShiftController,
  getRouteSheetController,
  listRouteSheetsController,
  markRouteSheetNeedsReviewController,
  startShiftController,
  updateRouteSheetAdminCommentController,
  verifyRouteSheetController,
} from '../controllers/routeSheet.controller.js';
import { authOfficer } from '../middleware/authOfficer.js';

export const routeSheetRouter = Router();
routeSheetRouter.post('/start', authOfficer, startShiftController);
routeSheetRouter.post('/finish', authOfficer, finishShiftController);
routeSheetRouter.get('/', listRouteSheetsController);
routeSheetRouter.post('/:id/verify', verifyRouteSheetController);
routeSheetRouter.post('/:id/mark-needs-review', markRouteSheetNeedsReviewController);
routeSheetRouter.patch('/:id/admin-comment', updateRouteSheetAdminCommentController);
routeSheetRouter.get('/:id', getRouteSheetController);
