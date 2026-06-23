import type { NextFunction, Request, Response } from 'express';
import {
  closeMonthlyRouteSheet,
  getMonthlyRouteSheet,
  getMonthlyRouteSheetPrintData,
  listMonthlyRouteSheets,
  markMonthlyRouteSheetPrinted,
} from '../services/monthlyRouteSheet.service.js';
import type { MonthlyRouteSheetFilters } from '../services/monthlyRouteSheet.service.js';

function metadata(request: Request) {
  return { ipAddress: request.ip, userAgent: request.get('user-agent') };
}

export async function listMonthlyRouteSheetsController(request: Request, response: Response, next: NextFunction) {
  try {
    const filters = Object.fromEntries(
      Object.entries(request.query).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ) as MonthlyRouteSheetFilters;
    response.json({ success: true, monthlyRouteSheets: await listMonthlyRouteSheets(filters) });
  } catch (error) { next(error); }
}

export async function getMonthlyRouteSheetController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, monthlyRouteSheet: await getMonthlyRouteSheet(request.params.id) }); } catch (error) { next(error); }
}

export async function closeMonthlyRouteSheetController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, monthlyRouteSheet: await closeMonthlyRouteSheet(request.params.id, metadata(request)) }); } catch (error) { next(error); }
}

export async function markMonthlyRouteSheetPrintedController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, monthlyRouteSheet: await markMonthlyRouteSheetPrinted(request.params.id, metadata(request)) }); } catch (error) { next(error); }
}

export async function getMonthlyRouteSheetPrintDataController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, monthlyRouteSheet: await getMonthlyRouteSheetPrintData(request.params.id) }); } catch (error) { next(error); }
}
