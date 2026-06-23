import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { RequestMetadata } from '../types/index.js';
import { createAuditLog } from './audit.service.js';

export interface MonthlyRouteSheetFilters {
  year?: string;
  month?: string;
  vehicleId?: string;
  status?: string;
  department?: string;
}

function monthlyWhere(filters: MonthlyRouteSheetFilters): Prisma.VehicleMonthlyRouteSheetWhereInput {
  const where: Prisma.VehicleMonthlyRouteSheetWhereInput = {};
  if (filters.year) where.year = Number(filters.year);
  if (filters.month) where.month = Number(filters.month);
  if (filters.vehicleId) where.vehicleId = filters.vehicleId;
  if (filters.status) where.status = filters.status;
  if (filters.department) where.department = { contains: filters.department, mode: 'insensitive' };
  return where;
}

function withShiftCount<T extends { _count?: { shiftEntries: number } }>(item: T) {
  const { _count, ...rest } = item;
  return { ...rest, shiftCount: _count?.shiftEntries ?? 0 };
}

export async function listMonthlyRouteSheets(filters: MonthlyRouteSheetFilters = {}) {
  const items = await prisma.vehicleMonthlyRouteSheet.findMany({
    where: monthlyWhere(filters),
    include: { _count: { select: { shiftEntries: true } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { vehicleBrand: 'asc' }, { vehicleModel: 'asc' }],
  });
  return items.map(withShiftCount);
}

export async function getMonthlyRouteSheet(id: string) {
  const item = await prisma.vehicleMonthlyRouteSheet.findUnique({
    where: { id },
    include: {
      shiftEntries: { orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }] },
      _count: { select: { shiftEntries: true } },
    },
  });
  if (!item) throw new AppError('Місячний маршрутний лист не знайдено.', 404);
  return withShiftCount(item);
}

export async function closeMonthlyRouteSheet(id: string, metadata: RequestMetadata = {}) {
  const item = await prisma.vehicleMonthlyRouteSheet.findUnique({ where: { id } });
  if (!item) throw new AppError('Місячний маршрутний лист не знайдено.', 404);
  const activeShift = await prisma.routeSheet.findFirst({ where: { monthlyRouteSheetId: id, status: 'active' } });
  if (activeShift) {
    throw new AppError('Неможливо закрити місяць: є незавершені зміни по цьому автомобілю.', 409);
  }
  const closed = await prisma.vehicleMonthlyRouteSheet.update({
    where: { id },
    data: { status: 'closed', closedAt: new Date(), adminCheckedBy: 'Адміністратор' },
  });
  await createAuditLog({
    action: 'Місячний маршрутний лист закрито',
    entityType: 'monthly_route_sheet',
    entityId: id,
    details: `${closed.vehicleBrand} ${closed.vehicleModel}; ${closed.displayVehicleNumber ?? closed.vehicleNumber}; ${closed.month}.${closed.year}`,
    ...metadata,
  });
  return closed;
}

export async function markMonthlyRouteSheetPrinted(id: string, metadata: RequestMetadata = {}) {
  const item = await prisma.vehicleMonthlyRouteSheet.findUnique({ where: { id } });
  if (!item) throw new AppError('Місячний маршрутний лист не знайдено.', 404);
  const printed = await prisma.vehicleMonthlyRouteSheet.update({ where: { id }, data: { printedAt: new Date() } });
  await createAuditLog({
    action: 'Місячний маршрутний лист позначено як надрукований',
    entityType: 'monthly_route_sheet',
    entityId: id,
    details: `${printed.vehicleBrand} ${printed.vehicleModel}; ${printed.displayVehicleNumber ?? printed.vehicleNumber}; ${printed.month}.${printed.year}`,
    ...metadata,
  });
  return printed;
}

export async function getMonthlyRouteSheetPrintData(id: string) {
  return getMonthlyRouteSheet(id);
}
