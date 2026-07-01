import type { MonthlyRouteSheet, MonthlyRouteSheetFilters } from '../types';
import { extractEntity, extractList } from '../utils/apiResponse';
import { apiDelete, apiGet, apiPost } from './apiClient';

interface MonthlyRouteSheetResponse {
  success: boolean;
  monthlyRouteSheet: MonthlyRouteSheet;
}

interface MonthlyRouteSheetsResponse {
  success: boolean;
  monthlyRouteSheets: MonthlyRouteSheet[];
}

function queryString(filters: MonthlyRouteSheetFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.size ? `?${params}` : '';
}

export async function getMonthlyRouteSheets(filters: MonthlyRouteSheetFilters = {}): Promise<MonthlyRouteSheet[]> {
  return extractList<MonthlyRouteSheet>(
    await apiGet<MonthlyRouteSheetsResponse>(`/api/monthly-route-sheets${queryString(filters)}`, { auth: 'admin' }),
    'monthlyRouteSheets',
  );
}

export async function getMonthlyRouteSheetById(id: string): Promise<MonthlyRouteSheet | null> {
  return extractEntity<MonthlyRouteSheet>(
    await apiGet<MonthlyRouteSheetResponse>(`/api/monthly-route-sheets/${encodeURIComponent(id)}`, { auth: 'admin' }),
    'monthlyRouteSheet',
  );
}

export async function closeMonthlyRouteSheet(id: string): Promise<MonthlyRouteSheet> {
  const monthlyRouteSheet = extractEntity<MonthlyRouteSheet>(
    await apiPost<MonthlyRouteSheetResponse>(`/api/monthly-route-sheets/${encodeURIComponent(id)}/close`, undefined, { auth: 'admin' }),
    'monthlyRouteSheet',
  );
  if (!monthlyRouteSheet) throw new Error('Не вдалося закрити місячний маршрутний лист.');
  return monthlyRouteSheet;
}

export async function reopenMonthlyRouteSheet(id: string): Promise<MonthlyRouteSheet> {
  const monthlyRouteSheet = extractEntity<MonthlyRouteSheet>(
    await apiPost<MonthlyRouteSheetResponse>(`/api/monthly-route-sheets/${encodeURIComponent(id)}/reopen`, undefined, { auth: 'admin' }),
    'monthlyRouteSheet',
  );
  if (!monthlyRouteSheet) throw new Error('Не вдалося повернути місячний маршрутний лист у роботу.');
  return monthlyRouteSheet;
}

export async function markMonthlyRouteSheetPrinted(id: string): Promise<MonthlyRouteSheet> {
  const monthlyRouteSheet = extractEntity<MonthlyRouteSheet>(
    await apiPost<MonthlyRouteSheetResponse>(`/api/monthly-route-sheets/${encodeURIComponent(id)}/mark-printed`, undefined, { auth: 'admin' }),
    'monthlyRouteSheet',
  );
  if (!monthlyRouteSheet) throw new Error('Не вдалося позначити місячний маршрутний лист як надрукований.');
  return monthlyRouteSheet;
}

export async function getMonthlyRouteSheetPrintData(id: string): Promise<MonthlyRouteSheet | null> {
  return extractEntity<MonthlyRouteSheet>(
    await apiGet<MonthlyRouteSheetResponse>(`/api/monthly-route-sheets/${encodeURIComponent(id)}/print-data`, { auth: 'admin' }),
    'monthlyRouteSheet',
  );
}

export async function deleteMonthlyRouteSheet(id: string, input: { reason: string; confirmText: string }): Promise<void> {
  await apiDelete(`/api/monthly-route-sheets/${encodeURIComponent(id)}`, input, { auth: 'admin' });
}
