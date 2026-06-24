import { Prisma, type RouteSheet, type Vehicle } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AdminTokenPayload, FinishShiftInput, RequestMetadata, RouteSheetFilters, RouteSheetStatus, StartShiftInput } from '../types/index.js';
import { normalizeVehicleNumber } from '../utils/normalizeVehicleNumber.js';
import { createAuditLog } from './audit.service.js';
import { validateBadgeNumber } from '../utils/badgeNumber.js';

function requiredText(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AppError(message, 400);
  return value.trim();
}

function optionalCrewNumber(value: unknown): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLocaleUpperCase('uk-UA')
    : null;
}

function requiredPhotoId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new AppError('Додайте фото одометра.', 400);
  return value.trim();
}

function nonNegativeInteger(value: unknown, message: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new AppError(message, 400);
  return Number(value);
}

function currentYearMonth(date = new Date()) {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function optionalFuel(input: FinishShiftInput) {
  const refueled = Boolean(input.refueled);
  if (!refueled) return { refueled: false, fuelLiters: null };
  const rawFuelLiters = (input as { fuelLiters?: unknown }).fuelLiters;
  const fuelLiters = Number(rawFuelLiters);
  if (rawFuelLiters === null || rawFuelLiters === undefined || rawFuelLiters === '') {
    throw new AppError('Вкажіть кількість літрів заправки.', 400);
  }
  if (!Number.isFinite(fuelLiters) || fuelLiters <= 0) {
    throw new AppError('Кількість літрів має бути числом більше 0.', 400);
  }
  return { refueled: true, fuelLiters };
}

async function getOrCreateMonthlyRouteSheet(
  tx: Prisma.TransactionClient,
  vehicle: Vehicle,
  date: Date,
  openingOdometer: number,
  metadata: RequestMetadata,
) {
  const { year, month } = currentYearMonth(date);
  const existing = await tx.vehicleMonthlyRouteSheet.findUnique({
    where: { vehicleId_year_month: { vehicleId: vehicle.id, year, month } },
  });
  if (existing) {
    if (existing.status !== 'open') throw new AppError('Місячний маршрутний лист для цього автомобіля вже закрито.', 409);
    if (existing.openingOdometer === null) {
      return tx.vehicleMonthlyRouteSheet.update({ where: { id: existing.id }, data: { openingOdometer } });
    }
    return existing;
  }
  const monthlyRouteSheet = await tx.vehicleMonthlyRouteSheet.create({
    data: {
      vehicleId: vehicle.id,
      vehicleNumber: vehicle.plateNumber,
      displayVehicleNumber: vehicle.displayPlateNumber,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model,
      department: vehicle.department,
      unit: vehicle.unit,
      year,
      month,
      status: 'open',
      openingOdometer,
    },
  });
  await createAuditLog({
    action: 'Створено місячний маршрутний лист автомобіля',
    entityType: 'monthly_route_sheet',
    entityId: monthlyRouteSheet.id,
    details: `${vehicle.brand} ${vehicle.model}; ${vehicle.displayPlateNumber ?? vehicle.plateNumber}; ${month}.${year}`,
    ...metadata,
  });
  return monthlyRouteSheet;
}

async function refreshMonthlyAggregates(tx: Prisma.TransactionClient, monthlyRouteSheetId: string) {
  const entries = await tx.routeSheet.findMany({
    where: {
      monthlyRouteSheetId,
      status: { in: ['completed', 'needs_review', 'verified'] },
      distanceKm: { not: null },
    },
    orderBy: [{ endedAt: 'asc' }, { updatedAt: 'asc' }],
  });
  const totalDistanceKm = entries.reduce((sum, entry) => sum + (entry.distanceKm ?? 0), 0);
  const totalFuelLiters = entries.reduce((sum, entry) => sum + (entry.refueled ? entry.fuelLiters ?? 0 : 0), 0);
  const lastCompleted = [...entries].reverse().find((entry) => entry.endOdometer !== null);
  return tx.vehicleMonthlyRouteSheet.update({
    where: { id: monthlyRouteSheetId },
    data: {
      totalDistanceKm,
      totalFuelLiters,
      closingOdometer: lastCompleted?.endOdometer ?? null,
    },
  });
}

export async function startShift(input: StartShiftInput, metadata: RequestMetadata = {}) {
  const badgeNumber = validateBadgeNumber(input.badgeNumber);
  const crewNumber = optionalCrewNumber(input.crewNumber);
  const vehicleNumber = normalizeVehicleNumber(requiredText(input.vehicleNumber, 'Вкажіть номер автомобіля.'));
  const startOdometer = nonNegativeInteger(input.startOdometer, 'Кілометраж має бути невід’ємним числом.');
  const startPhotoId = requiredPhotoId(input.startPhotoId);
  const duplicate = await prisma.routeSheet.findFirst({ where: { badgeNumber, status: 'active' } });
  if (duplicate) {
    await createAuditLog({ action: 'Спроба почати другу активну зміну', entityType: 'route_sheet', entityId: duplicate.id, badgeNumber, ...metadata });
    throw new AppError('У цього патрульного вже є активна зміна.', 409);
  }
  const busyVehicleShift = await prisma.routeSheet.findFirst({ where: { vehicleNumber, status: 'active' } });
  if (busyVehicleShift) {
    await createAuditLog({
      action: 'Перевірка зайнятості авто: старт заблоковано',
      entityType: 'route_sheet',
      entityId: busyVehicleShift.id,
      badgeNumber,
      details: `${vehicleNumber}; активна зміна: ${busyVehicleShift.fullName}`,
      ...metadata,
    });
    throw new AppError('Цей автомобіль вже використовується в активній зміні', 409);
  }
  const officer = await prisma.officer.findFirst({ where: { badgeNumber, isActive: true } });
  if (!officer) throw new AppError('Працівника з таким номером жетона не знайдено', 404);
  const vehicle = await prisma.vehicle.findFirst({ where: { plateNumber: vehicleNumber, isActive: true } });
  if (!vehicle) throw new AppError('Обраний автомобіль неактивний або не знайдений.', 400);
  let routeSheet: RouteSheet;
  try {
    routeSheet = await prisma.$transaction(async (tx) => {
      const startedAt = new Date();
      const monthlyRouteSheet = await getOrCreateMonthlyRouteSheet(tx, vehicle, startedAt, startOdometer, metadata);
      const createdRouteSheet = await tx.routeSheet.create({
        data: {
          monthlyRouteSheetId: monthlyRouteSheet.id,
          badgeNumber,
          fullName: officer.fullName,
          department: officer.department,
          unit: vehicle.unit ?? officer.unit,
          crewNumber,
          vehicleId: vehicle.id,
          vehicleNumber,
          displayVehicleNumber: vehicle.displayPlateNumber,
          vehicleBrand: vehicle.brand,
          vehicleModel: vehicle.model,
          startOdometer,
          startPhotoId,
          startManualEntry: true,
          status: 'active',
          startedAt,
        },
      });
      await tx.odometerPhoto.updateMany({ where: { id: startPhotoId }, data: { routeSheetId: createdRouteSheet.id, type: 'start' } });
      return createdRouteSheet;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('Цей автомобіль вже використовується в активній зміні', 409);
    }
    throw error;
  }
  await createAuditLog({
    action: 'Початок зміни: кілометраж внесено вручну, фото одометра збережено.', entityType: 'route_sheet', entityId: routeSheet.id, badgeNumber,
    details: `Екіпаж/підрозділ: ${crewNumber ?? '—'}; авто: ${vehicleNumber}`, ...metadata,
  });
  await createAuditLog({ action: 'Автомобіль вибрано', entityType: 'route_sheet', entityId: routeSheet.id, badgeNumber, details: vehicleNumber, ...metadata });
  return routeSheet;
}

export async function finishShift(input: FinishShiftInput, metadata: RequestMetadata = {}) {
  const badgeNumber = validateBadgeNumber(input.badgeNumber);
  const crewNumber = optionalCrewNumber(input.crewNumber);
  const vehicleNumber = normalizeVehicleNumber(requiredText(input.vehicleNumber, 'Вкажіть номер автомобіля.'));
  const endOdometer = nonNegativeInteger(input.endOdometer, 'Кілометраж має бути невід’ємним числом.');
  const endPhotoId = requiredPhotoId(input.endPhotoId);
  const fuel = optionalFuel(input);
  const active = await prisma.routeSheet.findFirst({
    where: { badgeNumber, vehicleNumber, status: 'active', ...(crewNumber ? { crewNumber } : {}) },
  });
  if (!active) throw new AppError('Активну зміну за вказаними даними не знайдено.', 404);
  if (endOdometer < active.startOdometer) {
    throw new AppError('Кінцевий кілометраж не може бути меншим за початковий.', 400);
  }
  const distanceKm = endOdometer - active.startOdometer;
  const status: RouteSheetStatus = distanceKm > 400 ? 'needs_review' : 'completed';
  const routeSheet = await prisma.$transaction(async (tx) => {
    let monthlyRouteSheetId = active.monthlyRouteSheetId;
    if (!monthlyRouteSheetId) {
      const vehicle = await tx.vehicle.findFirst({ where: { plateNumber: vehicleNumber } });
      if (vehicle) {
        const monthlyRouteSheet = await getOrCreateMonthlyRouteSheet(tx, vehicle, active.startedAt, active.startOdometer, metadata);
        monthlyRouteSheetId = monthlyRouteSheet.id;
      }
    }
    const updated = await tx.routeSheet.update({
      where: { id: active.id },
      data: {
        monthlyRouteSheetId,
        endOdometer,
        distanceKm,
        endPhotoId,
        endManualEntry: true,
        refueled: fuel.refueled,
        fuelLiters: fuel.fuelLiters,
        status,
        endedAt: new Date(),
      },
    });
    await tx.odometerPhoto.updateMany({ where: { id: endPhotoId }, data: { routeSheetId: updated.id, type: 'end' } });
    if (monthlyRouteSheetId) await refreshMonthlyAggregates(tx, monthlyRouteSheetId);
    return updated;
  });
  await createAuditLog({
    action: 'Завершення зміни: кілометраж внесено вручну, фото одометра збережено.',
    entityType: 'route_sheet', entityId: routeSheet.id, badgeNumber,
    details: `Пробіг: ${distanceKm} км`, ...metadata,
  });
  if (fuel.refueled) {
    await createAuditLog({
      action: 'Зафіксовано заправку під час завершення зміни',
      entityType: 'route_sheet',
      entityId: routeSheet.id,
      badgeNumber,
      details: `${fuel.fuelLiters} л; авто: ${vehicleNumber}`,
      ...metadata,
    });
  }
  return routeSheet;
}

function assertDepartmentAccess(actor: AdminTokenPayload | undefined, department: string) {
  if (actor?.role === 'REGIONAL_ADMIN' && department !== actor.department) {
    throw new AppError('Недостатньо прав для доступу до даних іншого управління', 403);
  }
}

export async function listRouteSheets(filters: RouteSheetFilters, actor?: AdminTokenPayload) {
  const where: Prisma.RouteSheetWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.badgeNumber) where.badgeNumber = filters.badgeNumber.trim();
  if (filters.vehicleNumber) where.vehicleNumber = normalizeVehicleNumber(filters.vehicleNumber);
  if (actor?.role === 'REGIONAL_ADMIN') where.department = actor.department ?? '';
  else if (filters.department) where.department = { contains: filters.department, mode: 'insensitive' };
  if (filters.unit) where.unit = { contains: filters.unit, mode: 'insensitive' };
  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: 'insensitive' } },
      { badgeNumber: { contains: filters.search } },
      { vehicleNumber: { contains: normalizeVehicleNumber(filters.search) } },
    ];
  }
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) where.createdAt.lte = new Date(filters.to);
  }
  return prisma.routeSheet.findMany({ where, orderBy: { createdAt: 'desc' } });
}

export async function listActiveRouteSheetsForOfficer(badgeNumber: string) {
  return prisma.routeSheet.findMany({
    where: { badgeNumber: validateBadgeNumber(badgeNumber), status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getRouteSheet(id: string, actor?: AdminTokenPayload) {
  const routeSheet = await prisma.routeSheet.findUnique({ where: { id } });
  if (!routeSheet) throw new AppError('Маршрутний лист не знайдено.', 404);
  assertDepartmentAccess(actor, routeSheet.department);
  return routeSheet;
}

export async function verifyRouteSheet(id: string, comment?: unknown, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const routeSheet = await prisma.routeSheet.findUnique({ where: { id } });
  if (!routeSheet) throw new AppError('Маршрутний лист не знайдено.', 404);
  assertDepartmentAccess(actor, routeSheet.department);
  if (routeSheet.status === 'active') throw new AppError('Неможливо перевірити активну незавершену зміну.', 400);
  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.routeSheet.update({
      where: { id },
      data: {
        status: 'verified',
        adminVerifiedAt: new Date(),
        adminVerifiedBy: 'Адміністратор',
        adminReviewComment: typeof comment === 'string' && comment.trim() ? comment.trim() : null,
      },
    });
    if (item.monthlyRouteSheetId) await refreshMonthlyAggregates(tx, item.monthlyRouteSheetId);
    return item;
  });
  await createAuditLog({
    action: 'Маршрутний запис перевірено адміністратором',
    entityType: 'route_sheet',
    entityId: updated.id,
    badgeNumber: updated.badgeNumber,
    details: updated.adminReviewComment ?? undefined,
    ...metadata,
  });
  return updated;
}

export async function markRouteSheetNeedsReview(id: string, comment?: unknown, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const routeSheet = await prisma.routeSheet.findUnique({ where: { id } });
  if (!routeSheet) throw new AppError('Маршрутний лист не знайдено.', 404);
  assertDepartmentAccess(actor, routeSheet.department);
  if (!['completed', 'verified', 'needs_review'].includes(routeSheet.status)) {
    throw new AppError('Повернути на перевірку можна тільки завершену, перевірену або вже проблемну зміну.', 400);
  }
  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.routeSheet.update({
      where: { id },
      data: {
        status: 'needs_review',
        adminReviewComment: typeof comment === 'string' && comment.trim() ? comment.trim() : null,
      },
    });
    if (item.monthlyRouteSheetId) await refreshMonthlyAggregates(tx, item.monthlyRouteSheetId);
    return item;
  });
  await createAuditLog({
    action: 'Маршрутний запис повернено на перевірку',
    entityType: 'route_sheet',
    entityId: updated.id,
    badgeNumber: updated.badgeNumber,
    details: updated.adminReviewComment ?? undefined,
    ...metadata,
  });
  return updated;
}

export async function updateRouteSheetAdminComment(id: string, comment?: unknown, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const routeSheet = await prisma.routeSheet.findUnique({ where: { id } });
  if (!routeSheet) throw new AppError('Маршрутний лист не знайдено.', 404);
  assertDepartmentAccess(actor, routeSheet.department);
  const updated = await prisma.routeSheet.update({
    where: { id },
    data: {
      adminReviewComment: typeof comment === 'string' && comment.trim() ? comment.trim() : null,
    },
  });
  await createAuditLog({
    action: 'Коментар адміністратора до маршрутного запису збережено',
    entityType: 'route_sheet',
    entityId: updated.id,
    badgeNumber: updated.badgeNumber,
    details: updated.adminReviewComment ?? undefined,
    ...metadata,
  });
  return updated;
}
