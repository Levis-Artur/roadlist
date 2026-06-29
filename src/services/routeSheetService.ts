import type { FinishShiftInput, RouteSheet, RouteSheetFilters, StartShiftInput } from '../types';
import { normalizeVehicleNumber } from '../utils/vehicleNumber';
import { BADGE_NUMBER_ERROR, isValidBadgeNumber } from '../utils/badgeNumber';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from './apiClient';
import { getOfficerToken } from './officerService';
import { extractEntity, extractList } from '../utils/apiResponse';

function normalizeRouteSheet(routeSheet: RouteSheet): RouteSheet {
  return {
    ...routeSheet,
    crewNumber: routeSheet.crewNumber?.trim() || null,
    endOdometer: routeSheet.endOdometer ?? undefined,
    distanceKm: routeSheet.distanceKm ?? undefined,
    startPhotoId: routeSheet.startPhotoId ?? undefined,
    endPhotoId: routeSheet.endPhotoId ?? undefined,
    startOcrValue: routeSheet.startOcrValue ?? undefined,
    endOcrValue: routeSheet.endOcrValue ?? undefined,
    endManualEntry: routeSheet.endManualEntry ?? undefined,
    refueled: routeSheet.refueled ?? false,
    fuelLiters: routeSheet.fuelLiters ?? undefined,
    adminVerifiedAt: routeSheet.adminVerifiedAt ?? undefined,
    adminVerifiedBy: routeSheet.adminVerifiedBy ?? undefined,
    adminReviewComment: routeSheet.adminReviewComment ?? undefined,
    endedAt: routeSheet.endedAt ?? undefined,
  };
}

function routeSheetQuery(filters: RouteSheetFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.department) params.set('department', filters.department);
  if (filters.unit) params.set('unit', filters.unit);
  return params.size ? `?${params.toString()}` : '';
}

export async function getRouteSheets(filters: RouteSheetFilters = {}): Promise<RouteSheet[]> {
  return extractList<RouteSheet>(await apiGet<unknown>(`/api/route-sheets${routeSheetQuery(filters)}`), 'routeSheets')
    .map(normalizeRouteSheet);
}

export async function getRouteSheetById(id: string): Promise<RouteSheet | null> {
  try {
    const routeSheet = extractEntity<RouteSheet>(await apiGet<unknown>(`/api/route-sheets/${encodeURIComponent(id)}`), 'routeSheet');
    return routeSheet ? normalizeRouteSheet(routeSheet) : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function deleteRouteSheet(id: string, input: { reason: string; confirmText: string }): Promise<void> {
  await apiDelete(`/api/route-sheets/${encodeURIComponent(id)}`, input);
}

export async function getActiveRouteSheetByOfficer(badgeNumber: string): Promise<RouteSheet | null> {
  return extractList<RouteSheet>(await apiGet<unknown>('/api/route-sheets/active/me'), 'routeSheets')
    .map(normalizeRouteSheet)
    .find((item) => item.badgeNumber === badgeNumber.trim() && item.status === 'active') ?? null;
}

export async function reportDuplicateShiftAttempt(_routeSheet: RouteSheet): Promise<void> {
  // Duplicate shift attempts are audited by the backend during the start-shift request.
}

export async function findActiveRouteSheetForFinish(
  badgeNumber: string,
  crewNumber: string | null | undefined,
  vehicleNumber: string,
): Promise<RouteSheet | null> {
  const activeSheet = await getActiveRouteSheetByOfficer(badgeNumber);
  if (!activeSheet) return null;
  const crewMatches = !crewNumber?.trim()
    || activeSheet.crewNumber?.toLocaleUpperCase('uk-UA') === crewNumber.trim().toLocaleUpperCase('uk-UA');
  return activeSheet.badgeNumber === badgeNumber.trim()
    && normalizeVehicleNumber(activeSheet.vehicleNumber) === normalizeVehicleNumber(vehicleNumber)
    && crewMatches
    ? activeSheet
    : null;
}

export async function startShift(input: StartShiftInput): Promise<RouteSheet> {
  if (!getOfficerToken()) throw new Error('Сесія завершилась. Увійдіть повторно.');
  if (!isValidBadgeNumber(input.officer.badgeNumber)) throw new Error(BADGE_NUMBER_ERROR);
  try {
    const response = await apiPost<unknown>('/api/route-sheets/start', {
      crewNumber: input.crewNumber?.trim() || null,
      vehicleNumber: normalizeVehicleNumber(input.vehicleNumber),
      startOdometer: input.startOdometer,
      startManualEntry: true,
      startPhotoId: input.startPhotoId,
    });
    const routeSheet = extractEntity<RouteSheet>(response, 'routeSheet');
    if (!routeSheet) throw new Error('Не вдалося зберегти маршрутний лист. Некоректна відповідь сервера.');
    return normalizeRouteSheet(routeSheet);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new Error('Сесія завершилась. Увійдіть повторно.');
    throw error;
  }
}

export async function finishShift(input: FinishShiftInput): Promise<RouteSheet> {
  if (!getOfficerToken()) throw new Error('Сесія завершилась. Увійдіть повторно.');
  if (!isValidBadgeNumber(input.badgeNumber)) throw new Error(BADGE_NUMBER_ERROR);
  try {
    const response = await apiPost<unknown>('/api/route-sheets/finish', {
      crewNumber: input.crewNumber?.trim() || null,
      vehicleNumber: normalizeVehicleNumber(input.vehicleNumber),
      endOdometer: input.endOdometer,
      endPhotoId: input.endPhotoId,
      endManualEntry: true,
      refueled: Boolean(input.refueled),
      fuelLiters: input.refueled ? input.fuelLiters : null,
    });
    const routeSheet = extractEntity<RouteSheet>(response, 'routeSheet');
    if (!routeSheet) throw new Error('Не вдалося зберегти маршрутний лист. Некоректна відповідь сервера.');
    return normalizeRouteSheet(routeSheet);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new Error('Сесія завершилась. Увійдіть повторно.');
    throw error;
  }
}

export async function verifyRouteSheet(id: string, comment?: string): Promise<RouteSheet> {
  const routeSheet = extractEntity<RouteSheet>(
    await apiPost<unknown>(`/api/route-sheets/${encodeURIComponent(id)}/verify`, { comment: comment?.trim() || null }),
    'routeSheet',
  );
  if (!routeSheet) throw new Error('Не вдалося позначити запис як перевірений.');
  return normalizeRouteSheet(routeSheet);
}

export async function markRouteSheetNeedsReview(id: string, comment?: string): Promise<RouteSheet> {
  const routeSheet = extractEntity<RouteSheet>(
    await apiPost<unknown>(`/api/route-sheets/${encodeURIComponent(id)}/mark-needs-review`, { comment }),
    'routeSheet',
  );
  if (!routeSheet) throw new Error('Не вдалося повернути запис на перевірку.');
  return normalizeRouteSheet(routeSheet);
}

export async function updateRouteSheetAdminComment(id: string, comment?: string | null): Promise<RouteSheet> {
  const routeSheet = extractEntity<RouteSheet>(
    await apiPatch<unknown>(`/api/route-sheets/${encodeURIComponent(id)}/admin-comment`, { comment: comment?.trim() || null }),
    'routeSheet',
  );
  if (!routeSheet) throw new Error('Не вдалося зберегти коментар адміністратора.');
  return normalizeRouteSheet(routeSheet);
}
