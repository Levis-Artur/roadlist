import { routeSheetStorage } from '../storage/routeSheetStorage';
import type { MonthlyRouteSheet, MonthlyRouteSheetFilters, RouteSheet } from '../types';
import { extractEntity, extractList } from '../utils/apiResponse';
import { apiDelete, apiGet, apiPost, isApiUnavailableError } from './apiClient';

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

function monthKey(routeSheet: RouteSheet) {
  const date = new Date(routeSheet.startedAt || routeSheet.createdAt);
  return `${routeSheet.vehicleNumber}-${date.getFullYear()}-${date.getMonth() + 1}`;
}

function localMonthlyRouteSheets(filters: MonthlyRouteSheetFilters = {}): MonthlyRouteSheet[] {
  const groups = new Map<string, RouteSheet[]>();
  routeSheetStorage.getAll().forEach((routeSheet) => {
    const key = monthKey(routeSheet);
    groups.set(key, [...groups.get(key) ?? [], routeSheet]);
  });

  const items = Array.from(groups.values()).map((entries) => {
    const sorted = [...entries].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    const first = sorted[0];
    const date = new Date(first.startedAt || first.createdAt);
    const key = `${first.vehicleNumber}-${date.getFullYear()}-${date.getMonth() + 1}`;
    const completed = sorted.filter((item) => item.status === 'completed' || item.status === 'needs_review' || item.status === 'verified');
    const lastCompleted = [...completed].reverse().find((item) => item.endOdometer !== undefined);
    const item: MonthlyRouteSheet = {
      id: first.monthlyRouteSheetId || `local-monthly-${key}`,
      vehicleId: first.vehicleId || first.vehicleNumber,
      vehicleNumber: first.vehicleNumber,
      displayVehicleNumber: first.displayVehicleNumber,
      vehicleBrand: first.vehicleBrand || 'Службовий автомобіль',
      vehicleModel: first.vehicleModel || '',
      department: first.department,
      unit: first.unit ?? null,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      status: sorted.some((entry) => entry.status === 'active') ? 'open' : 'open',
      openingOdometer: first.startOdometer,
      closingOdometer: lastCompleted?.endOdometer ?? null,
      totalDistanceKm: completed.reduce((sum, entry) => sum + (entry.distanceKm ?? 0), 0),
      totalFuelLiters: completed.reduce((sum, entry) => sum + (entry.refueled ? entry.fuelLiters ?? 0 : 0), 0),
      shiftCount: sorted.length,
      shiftEntries: sorted,
      createdAt: first.createdAt,
      updatedAt: sorted[sorted.length - 1]?.updatedAt ?? first.updatedAt,
    };
    return item;
  });

  return items.filter((item) => (!filters.year || item.year === filters.year)
    && (!filters.month || item.month === filters.month)
    && (!filters.vehicleId || item.vehicleId === filters.vehicleId)
    && (!filters.status || item.status === filters.status)
    && (!filters.department || item.department.toLocaleLowerCase('uk-UA').includes(filters.department.toLocaleLowerCase('uk-UA')))
    && (!filters.unit || (item.unit ?? '').toLocaleLowerCase('uk-UA').includes(filters.unit.toLocaleLowerCase('uk-UA'))));
}

export async function getMonthlyRouteSheets(filters: MonthlyRouteSheetFilters = {}): Promise<MonthlyRouteSheet[]> {
  try {
    return extractList<MonthlyRouteSheet>(
      await apiGet<MonthlyRouteSheetsResponse>(`/api/monthly-route-sheets${queryString(filters)}`),
      'monthlyRouteSheets',
    );
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    return localMonthlyRouteSheets(filters);
  }
}

export async function getMonthlyRouteSheetById(id: string): Promise<MonthlyRouteSheet | null> {
  try {
    return extractEntity<MonthlyRouteSheet>(
      await apiGet<MonthlyRouteSheetResponse>(`/api/monthly-route-sheets/${encodeURIComponent(id)}`),
      'monthlyRouteSheet',
    );
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    return localMonthlyRouteSheets().find((item) => item.id === id) ?? null;
  }
}

export async function closeMonthlyRouteSheet(id: string): Promise<MonthlyRouteSheet> {
  const monthlyRouteSheet = extractEntity<MonthlyRouteSheet>(
    await apiPost<MonthlyRouteSheetResponse>(`/api/monthly-route-sheets/${encodeURIComponent(id)}/close`),
    'monthlyRouteSheet',
  );
  if (!monthlyRouteSheet) throw new Error('Не вдалося закрити місячний маршрутний лист.');
  return monthlyRouteSheet;
}

export async function reopenMonthlyRouteSheet(id: string): Promise<MonthlyRouteSheet> {
  const monthlyRouteSheet = extractEntity<MonthlyRouteSheet>(
    await apiPost<MonthlyRouteSheetResponse>(`/api/monthly-route-sheets/${encodeURIComponent(id)}/reopen`),
    'monthlyRouteSheet',
  );
  if (!monthlyRouteSheet) throw new Error('Не вдалося повернути місячний маршрутний лист у роботу.');
  return monthlyRouteSheet;
}

export async function markMonthlyRouteSheetPrinted(id: string): Promise<MonthlyRouteSheet> {
  const monthlyRouteSheet = extractEntity<MonthlyRouteSheet>(
    await apiPost<MonthlyRouteSheetResponse>(`/api/monthly-route-sheets/${encodeURIComponent(id)}/mark-printed`),
    'monthlyRouteSheet',
  );
  if (!monthlyRouteSheet) throw new Error('Не вдалося позначити місячний маршрутний лист як надрукований.');
  return monthlyRouteSheet;
}

export async function getMonthlyRouteSheetPrintData(id: string): Promise<MonthlyRouteSheet | null> {
  try {
    return extractEntity<MonthlyRouteSheet>(
      await apiGet<MonthlyRouteSheetResponse>(`/api/monthly-route-sheets/${encodeURIComponent(id)}/print-data`),
      'monthlyRouteSheet',
    );
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    return getMonthlyRouteSheetById(id);
  }
}

export async function deleteMonthlyRouteSheet(id: string, input: { reason: string; confirmText: string }): Promise<void> {
  await apiDelete(`/api/monthly-route-sheets/${encodeURIComponent(id)}`, input);
}
