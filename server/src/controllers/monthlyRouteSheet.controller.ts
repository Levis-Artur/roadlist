import type { NextFunction, Request, Response } from 'express';
import {
  closeMonthlyRouteSheet,
  deleteMonthlyRouteSheet,
  getMonthlyRouteSheet,
  getMonthlyRouteSheetPrintData,
  listMonthlyRouteSheets,
  markMonthlyRouteSheetPrinted,
  reopenMonthlyRouteSheet,
} from '../services/monthlyRouteSheet.service.js';
import type { MonthlyRouteSheetFilters } from '../services/monthlyRouteSheet.service.js';

function metadata(request: Request) {
  return {
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
    actorAdminId: request.admin?.adminId,
    actorUsername: request.admin?.username,
    actorRole: request.admin?.role,
    actorDepartment: request.admin?.department ?? null,
    actorUnit: request.admin?.unit ?? null,
    actorDepartmentId: request.admin?.departmentId ?? null,
  };
}

export async function listMonthlyRouteSheetsController(request: Request, response: Response, next: NextFunction) {
  try {
    const filters = Object.fromEntries(
      Object.entries(request.query).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ) as MonthlyRouteSheetFilters;
    response.json({ success: true, monthlyRouteSheets: await listMonthlyRouteSheets(filters, request.admin) });
  } catch (error) { next(error); }
}

export async function getMonthlyRouteSheetController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, monthlyRouteSheet: await getMonthlyRouteSheet(request.params.id, request.admin) }); } catch (error) { next(error); }
}

export async function closeMonthlyRouteSheetController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, monthlyRouteSheet: await closeMonthlyRouteSheet(request.params.id, metadata(request), request.admin) }); } catch (error) { next(error); }
}

export async function markMonthlyRouteSheetPrintedController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, monthlyRouteSheet: await markMonthlyRouteSheetPrinted(request.params.id, metadata(request), request.admin) }); } catch (error) { next(error); }
}

export async function reopenMonthlyRouteSheetController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, monthlyRouteSheet: await reopenMonthlyRouteSheet(request.params.id, metadata(request), request.admin) }); } catch (error) { next(error); }
}

export async function getMonthlyRouteSheetPrintDataController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, monthlyRouteSheet: await getMonthlyRouteSheetPrintData(request.params.id, request.admin) }); } catch (error) { next(error); }
}

export async function deleteMonthlyRouteSheetController(request: Request, response: Response, next: NextFunction) {
  try {
    await deleteMonthlyRouteSheet(request.params.id, request.body ?? {}, metadata(request), request.admin);
    response.json({ success: true, message: 'Місячний маршрутний лист видалено' });
  } catch (error) { next(error); }
}
