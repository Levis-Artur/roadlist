import { routeSheetStorage } from '../storage/routeSheetStorage';
import type { FinishShiftInput, RouteSheet, RouteSheetFilters, StartShiftInput } from '../types';
import { normalizeVehicleNumber } from '../utils/vehicleNumber';
import { BADGE_NUMBER_ERROR, isValidBadgeNumber } from '../utils/badgeNumber';
import { ApiError, apiGet, apiPatch, apiPost, isApiUnavailableError } from './apiClient';
import { addAuditLog } from './auditService';
import { getOfficerToken } from './officerService';
import { extractEntity, extractList } from '../utils/apiResponse';
import { generateId } from '../utils/generateId';

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
    refueled: routeSheet.refueled ?? false,
    fuelLiters: routeSheet.fuelLiters ?? undefined,
    adminVerifiedAt: routeSheet.adminVerifiedAt ?? undefined,
    adminVerifiedBy: routeSheet.adminVerifiedBy ?? undefined,
    adminReviewComment: routeSheet.adminReviewComment ?? undefined,
    endedAt: routeSheet.endedAt ?? undefined,
  };
}

function localRouteSheets(filters: RouteSheetFilters = {}): RouteSheet[] {
  const query = filters.search?.trim().toLocaleLowerCase('uk-UA');
  return routeSheetStorage.getAll().filter((item) => {
    const matchesStatus = !filters.status || item.status === filters.status;
    const matchesQuery = !query || [item.fullName, item.badgeNumber, item.vehicleNumber]
      .some((value) => value.toLocaleLowerCase('uk-UA').includes(query));
    return matchesStatus && matchesQuery;
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
  const busyVehicleShift = localRouteSheets({ status: 'active' })
    .find((item) => normalizeVehicleNumber(item.vehicleNumber) === normalizeVehicleNumber(input.vehicleNumber));
  if (busyVehicleShift) {
    await localAudit('Перевірка зайнятості авто: старт заблоковано', busyVehicleShift);
    throw new Error('Цей автомобіль вже використовується в активній зміні. Почати нову зміну неможливо до завершення попередньої.');
  }
  if (!input.vehicleNumber.trim()) throw new Error('Вкажіть номер автомобіля.');
  if (!input.startPhotoId) throw new Error('Додайте фото одометра.');
  if (!Number.isFinite(input.startOdometer) || input.startOdometer < 0 || !Number.isInteger(input.startOdometer)) {
    throw new Error('Кілометраж має бути невід’ємним числом.');
  }
  const now = new Date().toISOString();
  const routeSheet: RouteSheet = {
    id: generateId('route-sheet'),
    ...input.officer,
    crewNumber: input.crewNumber?.trim().toLocaleUpperCase('uk-UA') || null,
    vehicleNumber: normalizeVehicleNumber(input.vehicleNumber),
    startOdometer: input.startOdometer,
    startPhotoId: input.startPhotoId,
    startManualEntry: true,
    status: 'active',
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  routeSheetStorage.add(routeSheet);
  await localAudit('Початок зміни: кілометраж внесено вручну, фото одометра збережено.', routeSheet);
  await localAudit('Автомобіль вибрано', routeSheet, routeSheet.vehicleNumber);
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
  if (!input.endPhotoId) throw new Error('Додайте фото одометра.');
  if (!Number.isFinite(input.endOdometer) || input.endOdometer < 0 || !Number.isInteger(input.endOdometer)) {
    throw new Error('Кілометраж має бути невід’ємним числом.');
  }
  if (input.refueled && (input.fuelLiters === null || input.fuelLiters === undefined)) {
    throw new Error('Вкажіть кількість літрів заправки.');
  }
  if (input.refueled && (!Number.isFinite(Number(input.fuelLiters)) || Number(input.fuelLiters) <= 0)) {
    throw new Error('Кількість літрів має бути числом більше 0.');
  }
  if (input.endOdometer < active.startOdometer) throw new Error('Кінцевий кілометраж не може бути меншим за початковий.');
  const distanceKm = input.endOdometer - active.startOdometer;
  const routeSheet: RouteSheet = {
    ...active,
    endOdometer: input.endOdometer,
    endManualEntry: true,
    endPhotoId: input.endPhotoId,
    distanceKm,
    refueled: Boolean(input.refueled),
    fuelLiters: input.refueled ? input.fuelLiters ?? null : null,
    status: distanceKm > 400 ? 'needs_review' : 'completed',
    endedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  routeSheetStorage.update(routeSheet);
  await localAudit('Завершення зміни: кілометраж внесено вручну, фото одометра збережено.', routeSheet, `Пробіг: ${distanceKm} км`);
  return routeSheet;
}

export async function getRouteSheets(filters: RouteSheetFilters = {}): Promise<RouteSheet[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
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
      startManualEntry: true,
      startPhotoId: input.startPhotoId,
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
    if (!isApiUnavailableError(error)) throw error;
    return finishShiftLocally(input);
  }
}

export async function verifyRouteSheet(id: string, comment?: string): Promise<RouteSheet> {
  try {
    const routeSheet = extractEntity<RouteSheet>(
      await apiPost<unknown>(`/api/route-sheets/${encodeURIComponent(id)}/verify`, { comment: comment?.trim() || null }),
      'routeSheet',
    );
    if (!routeSheet) throw new Error('Не вдалося позначити запис як перевірений.');
    return normalizeRouteSheet(routeSheet);
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const routeSheet = routeSheetStorage.getAll().find((item) => item.id === id);
    if (!routeSheet) throw new Error('Маршрутний лист не знайдено.');
    if (routeSheet.status === 'active') throw new Error('Неможливо перевірити активну незавершену зміну.');
    const updated: RouteSheet = {
      ...routeSheet,
      status: 'verified',
      adminVerifiedAt: new Date().toISOString(),
      adminVerifiedBy: 'Адміністратор',
      adminReviewComment: comment?.trim() || null,
      updatedAt: new Date().toISOString(),
    };
    routeSheetStorage.update(updated);
    await localAudit('Маршрутний запис перевірено адміністратором', updated, updated.adminReviewComment ?? undefined);
    return updated;
  }
}

export async function markRouteSheetNeedsReview(id: string, comment?: string): Promise<RouteSheet> {
  try {
    const routeSheet = extractEntity<RouteSheet>(
      await apiPost<unknown>(`/api/route-sheets/${encodeURIComponent(id)}/mark-needs-review`, { comment }),
      'routeSheet',
    );
    if (!routeSheet) throw new Error('Не вдалося повернути запис на перевірку.');
    return normalizeRouteSheet(routeSheet);
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const routeSheet = routeSheetStorage.getAll().find((item) => item.id === id);
    if (!routeSheet) throw new Error('Маршрутний лист не знайдено.');
    if (!['completed', 'verified', 'needs_review'].includes(routeSheet.status)) throw new Error('Повернути на перевірку можна тільки завершену, перевірену або вже проблемну зміну.');
    const updated: RouteSheet = {
      ...routeSheet,
      status: 'needs_review',
      adminReviewComment: comment?.trim() || null,
      updatedAt: new Date().toISOString(),
    };
    routeSheetStorage.update(updated);
    await localAudit('Маршрутний запис повернено на перевірку', updated, updated.adminReviewComment ?? undefined);
    return updated;
  }
}

export async function updateRouteSheetAdminComment(id: string, comment?: string | null): Promise<RouteSheet> {
  try {
    const routeSheet = extractEntity<RouteSheet>(
      await apiPatch<unknown>(`/api/route-sheets/${encodeURIComponent(id)}/admin-comment`, { comment: comment?.trim() || null }),
      'routeSheet',
    );
    if (!routeSheet) throw new Error('Не вдалося зберегти коментар адміністратора.');
    return normalizeRouteSheet(routeSheet);
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const routeSheet = routeSheetStorage.getAll().find((item) => item.id === id);
    if (!routeSheet) throw new Error('Маршрутний лист не знайдено.');
    const updated: RouteSheet = {
      ...routeSheet,
      adminReviewComment: comment?.trim() || null,
      updatedAt: new Date().toISOString(),
    };
    routeSheetStorage.update(updated);
    await localAudit('Коментар адміністратора до маршрутного запису збережено', updated, updated.adminReviewComment ?? undefined);
    return updated;
  }
}

export async function clearRouteSheets(): Promise<void> {
  routeSheetStorage.clear();
}
