import { Prisma, type RouteSheet } from '@prisma/client';
import { prisma } from '../config/prisma.js';
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

function requiredPhotoId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new AppError('Додайте фото одометра.', 400);
  return value.trim();
}

function nonNegativeInteger(value: unknown, message: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new AppError(message, 400);
  return Number(value);
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
  const officer = await prisma.officer.findFirst({ where: { badgeNumber, isActive: true } });
  if (!officer) throw new AppError('Працівника з таким номером жетона не знайдено', 404);
  const vehicle = await prisma.vehicle.findFirst({ where: { plateNumber: vehicleNumber, isActive: true } });
  if (!vehicle) throw new AppError('Обраний автомобіль неактивний або не знайдений.', 400);
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
        startPhotoId,
        startManualEntry: true,
        status: 'active',
        startedAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('У цього патрульного вже є активна зміна.', 409);
    }
    throw error;
  }
  await prisma.odometerPhoto.updateMany({ where: { id: startPhotoId }, data: { routeSheetId: routeSheet.id, type: 'start' } });
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
  const active = await prisma.routeSheet.findFirst({
    where: { badgeNumber, vehicleNumber, status: 'active', ...(crewNumber ? { crewNumber } : {}) },
  });
  if (!active) throw new AppError('Активну зміну за вказаними даними не знайдено.', 404);
  if (endOdometer < active.startOdometer) {
    throw new AppError('Кінцевий кілометраж не може бути меншим за початковий.', 400);
  }
  const distanceKm = endOdometer - active.startOdometer;
  const status: RouteSheetStatus = distanceKm > 400 ? 'needs_review' : 'completed';
  const routeSheet = await prisma.routeSheet.update({
    where: { id: active.id },
    data: {
      endOdometer,
      distanceKm,
      endPhotoId,
      endManualEntry: true,
      status,
      endedAt: new Date(),
    },
  });
  await prisma.odometerPhoto.updateMany({ where: { id: endPhotoId }, data: { routeSheetId: routeSheet.id, type: 'end' } });
  await createAuditLog({
    action: 'Завершення зміни: кілометраж внесено вручну, фото одометра збережено.',
    entityType: 'route_sheet', entityId: routeSheet.id, badgeNumber,
    details: `Пробіг: ${distanceKm} км`, ...metadata,
  });
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
