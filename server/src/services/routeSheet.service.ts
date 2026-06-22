import { Prisma, type RouteSheet } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import type { FinishShiftInput, RequestMetadata, RouteSheetFilters, RouteSheetStatus, StartShiftInput } from '../types/index.js';
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

function positiveInteger(value: unknown, message: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) throw new AppError(message, 400);
  return Number(value);
}

export async function startShift(input: StartShiftInput, metadata: RequestMetadata = {}) {
  const badgeNumber = validateBadgeNumber(input.badgeNumber);
  const crewNumber = optionalCrewNumber(input.crewNumber);
  const vehicleNumber = normalizeVehicleNumber(requiredText(input.vehicleNumber, 'Вкажіть номер автомобіля.'));
  const startOdometer = positiveInteger(input.startOdometer, 'Початковий кілометраж має бути цілим числом більше 0.');
  const duplicate = await prisma.routeSheet.findFirst({ where: { badgeNumber, status: 'active' } });
  if (duplicate) {
    await createAuditLog({ action: 'Спроба почати другу активну зміну', entityType: 'route_sheet', entityId: duplicate.id, badgeNumber, ...metadata });
    throw new AppError('У цього патрульного вже є активна зміна.', 409);
  }
  const officer = await prisma.officer.findFirst({ where: { badgeNumber, isActive: true } });
  if (!officer) throw new AppError('Працівника з таким номером жетона не знайдено', 404);
  if (env.pilotMode) {
    const pilotAccess = await prisma.pilotOfficerAccess.findFirst({
      where: { badgeNumber, department: env.pilotDepartment, isActive: true },
    });
    if (!pilotAccess) throw new AppError('Цей працівник не включений до пілотного тестування.', 403);
    const vehicle = await prisma.vehicle.findFirst({
      where: { plateNumber: vehicleNumber, department: env.pilotDepartment, isActive: true, isPilotActive: true },
    });
    if (!vehicle) throw new AppError('Обраний автомобіль недоступний для пілотного тестування.', 400);
  }
  const pilotComment = typeof input.pilotComment === 'string' && input.pilotComment.trim()
    ? `Початок: ${input.pilotComment.trim()}`
    : undefined;
  let routeSheet: RouteSheet;
  try {
    routeSheet = await prisma.routeSheet.create({
      data: {
        badgeNumber,
        fullName: officer.fullName,
        department: officer.department,
        crewNumber,
        vehicleNumber,
        startOdometer,
        startPhotoId: input.startPhotoId,
        startOcrValue: input.startOcrValue,
        startManualEntry: Boolean(input.startManualEntry),
        status: 'active',
        startedAt: new Date(),
        isPilot: env.pilotMode,
        pilotDepartment: env.pilotMode ? env.pilotDepartment : undefined,
        pilotComment,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('У цього патрульного вже є активна зміна.', 409);
    }
    throw error;
  }
  if (input.startPhotoId) {
    await prisma.odometerPhoto.updateMany({ where: { id: input.startPhotoId }, data: { routeSheetId: routeSheet.id, type: 'start' } });
  }
  await createAuditLog({
    action: env.pilotMode ? 'Пілотна зміна розпочата' : 'Зміну розпочато', entityType: 'route_sheet', entityId: routeSheet.id, badgeNumber,
    details: `Екіпаж/підрозділ: ${crewNumber ?? '—'}; авто: ${vehicleNumber}`, ...metadata,
  });
  if (env.pilotMode) {
    await createAuditLog({ action: 'Автомобіль вибрано', entityType: 'route_sheet', entityId: routeSheet.id, badgeNumber, details: vehicleNumber, ...metadata });
    if (pilotComment) await createAuditLog({ action: 'Додано коментар пілоту', entityType: 'route_sheet', entityId: routeSheet.id, badgeNumber, details: pilotComment, ...metadata });
  }
  return routeSheet;
}

export async function finishShift(input: FinishShiftInput, metadata: RequestMetadata = {}) {
  const badgeNumber = validateBadgeNumber(input.badgeNumber);
  const crewNumber = optionalCrewNumber(input.crewNumber);
  const vehicleNumber = normalizeVehicleNumber(requiredText(input.vehicleNumber, 'Вкажіть номер автомобіля.'));
  const endOdometer = positiveInteger(input.endOdometer, 'Кінцевий кілометраж має бути цілим числом більше 0.');
  const active = await prisma.routeSheet.findFirst({
    where: { badgeNumber, vehicleNumber, status: 'active', ...(crewNumber ? { crewNumber } : {}) },
  });
  if (!active) throw new AppError('Активну зміну за вказаними даними не знайдено.', 404);
  if (endOdometer < active.startOdometer) {
    throw new AppError('Кінцевий кілометраж не може бути меншим за початковий.', 400);
  }
  const distanceKm = endOdometer - active.startOdometer;
  const status: RouteSheetStatus = distanceKm > 400 ? 'needs_review' : 'completed';
  const finishComment = typeof input.pilotComment === 'string' && input.pilotComment.trim()
    ? `Завершення: ${input.pilotComment.trim()}`
    : undefined;
  const pilotComment = [active.pilotComment, finishComment].filter(Boolean).join('\n') || undefined;
  const routeSheet = await prisma.routeSheet.update({
    where: { id: active.id },
    data: {
      endOdometer,
      distanceKm,
      endPhotoId: input.endPhotoId,
      endOcrValue: input.endOcrValue,
      endManualEntry: Boolean(input.endManualEntry),
      status,
      endedAt: new Date(),
      pilotComment,
    },
  });
  if (input.endPhotoId) {
    await prisma.odometerPhoto.updateMany({ where: { id: input.endPhotoId }, data: { routeSheetId: routeSheet.id, type: 'end' } });
  }
  await createAuditLog({
    action: active.isPilot
      ? status === 'needs_review' ? 'Пілотний запис потребує перевірки' : 'Пілотна зміна завершена'
      : status === 'needs_review' ? 'Зміну завершено: потребує перевірки' : 'Зміну завершено',
    entityType: 'route_sheet', entityId: routeSheet.id, badgeNumber,
    details: `Пробіг: ${distanceKm} км`, ...metadata,
  });
  if (active.isPilot && finishComment) {
    await createAuditLog({ action: 'Додано коментар пілоту', entityType: 'route_sheet', entityId: routeSheet.id, badgeNumber, details: finishComment, ...metadata });
  }
  return routeSheet;
}

export async function listRouteSheets(filters: RouteSheetFilters) {
  const where: Prisma.RouteSheetWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.badgeNumber) where.badgeNumber = filters.badgeNumber.trim();
  if (filters.vehicleNumber) where.vehicleNumber = normalizeVehicleNumber(filters.vehicleNumber);
  if (filters.department) where.department = { contains: filters.department, mode: 'insensitive' };
  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: 'insensitive' } },
      { badgeNumber: { contains: filters.search } },
      { vehicleNumber: { contains: normalizeVehicleNumber(filters.search) } },
    ];
  }
  if (filters.isPilot === 'true') where.isPilot = true;
  if (filters.isPilot === 'false') where.isPilot = false;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) where.createdAt.lte = new Date(filters.to);
  }
  return prisma.routeSheet.findMany({ where, orderBy: { createdAt: 'desc' } });
}

export async function getRouteSheet(id: string) {
  const routeSheet = await prisma.routeSheet.findUnique({ where: { id } });
  if (!routeSheet) throw new AppError('Маршрутний лист не знайдено.', 404);
  return routeSheet;
}
