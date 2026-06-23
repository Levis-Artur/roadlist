import type { NextFunction, Request, Response } from 'express';
import { finishShift, getRouteSheet, listActiveRouteSheetsForOfficer, listRouteSheets, markRouteSheetNeedsReview, startShift, updateRouteSheetAdminComment, verifyRouteSheet } from '../services/routeSheet.service.js';
import type { FinishShiftInput, RouteSheetFilters, StartShiftInput } from '../types/index.js';

function metadata(request: Request) {
  return {
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
    actorAdminId: request.admin?.adminId,
    actorUsername: request.admin?.username,
    actorRole: request.admin?.role,
    actorDepartment: request.admin?.department ?? null,
  };
}

export async function startShiftController(request: Request, response: Response, next: NextFunction) {
  try {
    const input = { ...(request.body ?? {}), badgeNumber: request.officer!.badgeNumber } as StartShiftInput;
    const routeSheet = await startShift(input, metadata(request));
    response.status(201).json({ success: true, routeSheet });
  } catch (error) {
    next(error);
  }
}

export async function finishShiftController(request: Request, response: Response, next: NextFunction) {
  try {
    const input = { ...(request.body ?? {}), badgeNumber: request.officer!.badgeNumber } as FinishShiftInput;
    const routeSheet = await finishShift(input, metadata(request));
    response.json({ success: true, routeSheet });
  } catch (error) {
    next(error);
  }
}

export async function listRouteSheetsController(request: Request, response: Response, next: NextFunction) {
  try {
    const filters = Object.fromEntries(
      Object.entries(request.query).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ) as RouteSheetFilters;
    const routeSheets = await listRouteSheets(filters, request.admin);
    response.json({ success: true, routeSheets: Array.isArray(routeSheets) ? routeSheets : [] });
  } catch (error) {
    next(error);
  }
}

export async function listMyActiveRouteSheetsController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, routeSheets: await listActiveRouteSheetsForOfficer(request.officer!.badgeNumber) });
  } catch (error) {
    next(error);
  }
}

export async function getRouteSheetController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, routeSheet: await getRouteSheet(request.params.id, request.admin) });
  } catch (error) {
    next(error);
  }
}

export async function verifyRouteSheetController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, routeSheet: await verifyRouteSheet(request.params.id, request.body?.comment, metadata(request), request.admin) });
  } catch (error) {
    next(error);
  }
}

export async function markRouteSheetNeedsReviewController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, routeSheet: await markRouteSheetNeedsReview(request.params.id, request.body?.comment, metadata(request), request.admin) });
  } catch (error) {
    next(error);
  }
}

export async function updateRouteSheetAdminCommentController(request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ success: true, routeSheet: await updateRouteSheetAdminComment(request.params.id, request.body?.comment, metadata(request), request.admin) });
  } catch (error) {
    next(error);
  }
}
