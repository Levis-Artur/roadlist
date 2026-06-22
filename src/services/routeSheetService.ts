import { routeSheetStorage } from '../storage/routeSheetStorage';
import type { FinishShiftInput, RouteSheet, RouteSheetFilters, StartShiftInput } from '../types';
import { normalizeVehicleNumber } from '../utils/vehicleNumber';
import { BADGE_NUMBER_ERROR, isValidBadgeNumber } from '../utils/badgeNumber';
import { ApiError, apiGet, apiPost, isApiUnavailableError } from './apiClient';
import { addAuditLog } from './auditService';
import { getOfficerToken } from './officerService';
import { extractEntity, extractList } from '../utils/apiResponse';

interface RouteSheetResponse {
  success: boolean;
  routeSheet: RouteSheet;
}

interface RouteSheetsResponse {
  success: boolean;
  routeSheets: RouteSheet[];
}

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
    endedAt: routeSheet.endedAt ?? undefined,
    pilotDepartment: routeSheet.pilotDepartment ?? undefined,
    pilotComment: routeSheet.pilotComment ?? undefined,
  };
}

function localRouteSheets(filters: RouteSheetFilters = {}): RouteSheet[] {
  const query = filters.search?.trim().toLocaleLowerCase('uk-UA');
  return routeSheetStorage.getAll().filter((item) => {
    const matchesStatus = !filters.status || item.status === filters.status;
    const matchesPilot = filters.isPilot === undefined || Boolean(item.isPilot) === filters.isPilot;
    const matchesQuery = !query || [item.fullName, item.badgeNumber, item.vehicleNumber]
      .some((value) => value.toLocaleLowerCase('uk-UA').includes(query));
    return matchesStatus && matchesPilot && matchesQuery;
  });
}

async function localAudit(action: string, routeSheet: RouteSheet, details?: string) {
  await addAuditLog({
    action,
    entityType: 'route_sheet',
    entityId: routeSheet.id,
    badgeNumber: routeSheet.badgeNumber,
    details,
  }).catch(() => undefined);
}

async function startShiftLocally(input: StartShiftInput): Promise<RouteSheet> {
  const duplicate = localRouteSheets({ status: 'active' })
    .find((item) => item.badgeNumber === input.officer.badgeNumber);
  if (duplicate) {
    await localAudit('Спроба почати другу активну зміну', duplicate);
    throw new Error('У цього патрульного вже є активна зміна. Спочатку завершіть поточну зміну.');
  }
  if (!input.vehicleNumber.trim()) throw new Error('Вкажіть номер автомобіля.');
  if (!input.startPhotoId) throw new Error('Додайте фото одометра.');
  if (!Number.isFinite(input.startOdometer) || input.startOdometer <= 0) throw new Error('Кілометраж має бути числом більше 0.');
  const now = new Date().toISOString();
  const routeSheet: RouteSheet = {
    id: crypto.randomUUID(),
    ...input.officer,
    crewNumber: input.crewNumber?.trim().toLocaleUpperCase('uk-UA') || null,
    vehicleNumber: normalizeVehicleNumber(input.vehicleNumber),
    startOdometer: input.startOdometer,
    startPhotoId: input.startPhotoId,
    startOcrValue: input.startOcrValue,
    startManualEntry: input.startManualEntry,
    status: 'active',
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    isPilot: true,
    pilotDepartment: 'УПП у Волинській області',
    pilotComment: input.pilotComment?.trim() ? `Початок: ${input.pilotComment.trim()}` : undefined,
  };
  routeSheetStorage.add(routeSheet);
  await localAudit('Пілотна зміна розпочата', routeSheet);
  await localAudit('Автомобіль вибрано', routeSheet, routeSheet.vehicleNumber);
  if (routeSheet.pilotComment) await localAudit('Додано коментар пілоту', routeSheet, routeSheet.pilotComment);
  return routeSheet;
}

async function finishShiftLocally(input: FinishShiftInput): Promise<RouteSheet> {
  const active = localRouteSheets({ status: 'active' }).find(
    (item) => item.badgeNumber === input.badgeNumber
      && normalizeVehicleNumber(item.vehicleNumber) === normalizeVehicleNumber(input.vehicleNumber)
      && (!input.crewNumber?.trim()
        || item.crewNumber?.toLocaleUpperCase('uk-UA') === input.crewNumber.trim().toLocaleUpperCase('uk-UA')),
  );
  if (!active) throw new Error('Активну зміну за вказаними даними не знайдено.');
  if (input.endOdometer < active.startOdometer) throw new Error('Кінцевий кілометраж не може бути меншим за початковий.');
  const distanceKm = input.endOdometer - active.startOdometer;
  const routeSheet: RouteSheet = {
    ...active,
    endOdometer: input.endOdometer,
    endOcrValue: input.endOcrValue,
    endManualEntry: input.endManualEntry,
    endPhotoId: input.endPhotoId,
    distanceKm,
    status: distanceKm > 400 ? 'needs_review' : 'completed',
    endedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pilotComment: [
      active.pilotComment,
      input.pilotComment?.trim() ? `Завершення: ${input.pilotComment.trim()}` : undefined,
    ].filter(Boolean).join('\n') || undefined,
  };
  routeSheetStorage.update(routeSheet);
  await localAudit(routeSheet.status === 'needs_review' ? 'Пілотний запис потребує перевірки' : 'Пілотна зміна завершена', routeSheet, `Пробіг: ${distanceKm} км`);
  if (input.pilotComment?.trim()) await localAudit('Додано коментар пілоту', routeSheet, `Завершення: ${input.pilotComment.trim()}`);
  return routeSheet;
}

export async function getRouteSheets(filters: RouteSheetFilters = {}): Promise<RouteSheet[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.isPilot !== undefined) params.set('isPilot', String(filters.isPilot));
  try {
    const query = params.size ? `?${params.toString()}` : '';
    return extractList<RouteSheet>(await apiGet<unknown>(`/api/route-sheets${query}`), 'routeSheets').map(normalizeRouteSheet);
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    return localRouteSheets(filters);
  }
}

export async function getRouteSheetById(id: string): Promise<RouteSheet | null> {
  try {
    const routeSheet = extractEntity<RouteSheet>(await apiGet<unknown>(`/api/route-sheets/${encodeURIComponent(id)}`), 'routeSheet');
    return routeSheet ? normalizeRouteSheet(routeSheet) : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    if (!isApiUnavailableError(error)) throw error;
    return routeSheetStorage.getAll().find((item) => item.id === id) ?? null;
  }
}

export async function getActiveRouteSheetByOfficer(badgeNumber: string): Promise<RouteSheet | null> {
  return (await getRouteSheets({ status: 'active', search: badgeNumber })).find(
    (item) => item.badgeNumber === badgeNumber.trim() && item.status === 'active',
  ) ?? null;
}

export async function reportDuplicateShiftAttempt(routeSheet: RouteSheet): Promise<void> {
  await localAudit('Спроба почати другу активну зміну', routeSheet, `Екіпаж/підрозділ: ${routeSheet.crewNumber || '—'}`);
}

export async function findActiveRouteSheetForFinish(
  badgeNumber: string,
  crewNumber: string | null | undefined,
  vehicleNumber: string,
): Promise<RouteSheet | null> {
  return (await getRouteSheets({ status: 'active', search: badgeNumber })).find(
    (item) => item.badgeNumber === badgeNumber.trim()
      && normalizeVehicleNumber(item.vehicleNumber) === normalizeVehicleNumber(vehicleNumber)
      && (!crewNumber?.trim()
        || item.crewNumber?.toLocaleUpperCase('uk-UA') === crewNumber.trim().toLocaleUpperCase('uk-UA')),
  ) ?? null;
}

export async function startShift(input: StartShiftInput): Promise<RouteSheet> {
  if (!getOfficerToken()) throw new Error('Сесія завершилась. Увійдіть повторно.');
  if (!isValidBadgeNumber(input.officer.badgeNumber)) throw new Error(BADGE_NUMBER_ERROR);
  try {
    const response = await apiPost<unknown>('/api/route-sheets/start', {
      crewNumber: input.crewNumber?.trim() || null,
      vehicleNumber: normalizeVehicleNumber(input.vehicleNumber),
      startOdometer: input.startOdometer,
      startOcrValue: input.startOcrValue,
      startManualEntry: input.startManualEntry,
      startPhotoId: input.startPhotoId,
      pilotComment: input.pilotComment,
    });
    const routeSheet = extractEntity<RouteSheet>(response, 'routeSheet');
    if (!routeSheet) throw new Error('Не вдалося зберегти маршрутний лист. Некоректна відповідь сервера.');
    return normalizeRouteSheet(routeSheet);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new Error('Сесія завершилась. Увійдіть повторно.');
    if (!isApiUnavailableError(error)) throw error;
    return startShiftLocally(input);
  }
}

export async function finishShift(input: FinishShiftInput): Promise<RouteSheet> {
  if (!getOfficerToken()) throw new Error('Сесія завершилась. Увійдіть повторно.');
  if (!isValidBadgeNumber(input.badgeNumber)) throw new Error(BADGE_NUMBER_ERROR);
  try {
    const { badgeNumber: _badgeNumber, ...finishInput } = input;
    const response = await apiPost<unknown>('/api/route-sheets/finish', {
      ...finishInput,
      crewNumber: input.crewNumber?.trim() || null,
      vehicleNumber: normalizeVehicleNumber(input.vehicleNumber),
    });
    const routeSheet = extractEntity<RouteSheet>(response, 'routeSheet');
    if (!routeSheet) throw new Error('Не вдалося зберегти маршрутний лист. Некоректна відповідь сервера.');
    return normalizeRouteSheet(routeSheet);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new Error('Сесія завершилась. Увійдіть повторно.');
    if (!isApiUnavailableError(error)) throw error;
    return finishShiftLocally(input);
  }
}

export async function clearRouteSheets(): Promise<void> {
  routeSheetStorage.clear();
}
