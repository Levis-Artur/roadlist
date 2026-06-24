import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AdminTokenPayload, RequestMetadata } from '../types/index.js';
import { createAuditLog } from './audit.service.js';
import { assertDepartmentScope } from './organization.service.js';
import { canIncludeDeleted, deletionAuditMetadata, deletionPayload } from './softDelete.service.js';

export interface MonthlyRouteSheetFilters {
  year?: string;
  month?: string;
  vehicleId?: string;
  status?: string;
  department?: string;
  unit?: string;
  departmentId?: string;
  departmentUnitId?: string;
  includeDeleted?: string;
}

function monthlyWhere(filters: MonthlyRouteSheetFilters, actor?: AdminTokenPayload): Prisma.VehicleMonthlyRouteSheetWhereInput {
  const where: Prisma.VehicleMonthlyRouteSheetWhereInput = {};
  where.isDeleted = canIncludeDeleted(actor, filters.includeDeleted) ? undefined : false;
  if (filters.year) where.year = Number(filters.year);
  if (filters.month) where.month = Number(filters.month);
  if (filters.vehicleId) where.vehicleId = filters.vehicleId;
  if (filters.status) where.status = filters.status;
  if (actor?.role === 'REGIONAL_ADMIN') {
    if (actor.departmentId) where.departmentId = actor.departmentId;
    else where.department = actor.departmentName ?? actor.department ?? '';
  }
  else if (filters.department) where.department = { contains: filters.department, mode: 'insensitive' };
  if (filters.departmentId && actor?.role !== 'REGIONAL_ADMIN') where.departmentId = filters.departmentId;
  if (filters.unit) where.unit = { contains: filters.unit, mode: 'insensitive' };
  if (filters.departmentUnitId) where.departmentUnitId = filters.departmentUnitId;
  return where;
}

function assertDepartmentAccess(actor: AdminTokenPayload | undefined, department: string) {
  if (actor?.role === 'REGIONAL_ADMIN' && department !== actor.department) {
    throw new AppError('Недостатньо прав для доступу до даних іншого управління', 403);
  }
}

function withShiftCount<T extends { _count?: { shiftEntries: number } }>(item: T) {
  const { _count, ...rest } = item;
  return { ...rest, shiftCount: _count?.shiftEntries ?? 0 };
}

export async function listMonthlyRouteSheets(filters: MonthlyRouteSheetFilters = {}, actor?: AdminTokenPayload) {
  const items = await prisma.vehicleMonthlyRouteSheet.findMany({
    where: monthlyWhere(filters, actor),
    include: { _count: { select: { shiftEntries: true } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { vehicleBrand: 'asc' }, { vehicleModel: 'asc' }],
  });
  return items.map(withShiftCount);
}

export async function getMonthlyRouteSheet(id: string, actor?: AdminTokenPayload) {
  const item = await prisma.vehicleMonthlyRouteSheet.findUnique({
    where: { id },
    include: {
      shiftEntries: { where: { isDeleted: false }, orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }] },
      _count: { select: { shiftEntries: true } },
    },
  });
  if (!item || (item.isDeleted && actor?.role !== 'SYSTEM_OWNER')) throw new AppError('Місячний маршрутний лист не знайдено.', 404);
  assertDepartmentScope(actor, item);
  return withShiftCount(item);
}

export async function closeMonthlyRouteSheet(id: string, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const item = await prisma.vehicleMonthlyRouteSheet.findUnique({ where: { id } });
  if (!item || item.isDeleted) throw new AppError('Місячний маршрутний лист не знайдено.', 404);
  assertDepartmentScope(actor, item);
  const activeShift = await prisma.routeSheet.findFirst({ where: { monthlyRouteSheetId: id, status: 'active', isDeleted: false } });
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

export async function reopenMonthlyRouteSheet(id: string, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const item = await prisma.vehicleMonthlyRouteSheet.findUnique({ where: { id } });
  if (!item || item.isDeleted) throw new AppError('Місячний маршрутний лист не знайдено.', 404);
  assertDepartmentScope(actor, item);
  const reopened = await prisma.vehicleMonthlyRouteSheet.update({
    where: { id },
    data: { status: 'open', closedAt: null, adminCheckedBy: null },
  });
  await createAuditLog({
    action: 'Місячний маршрутний лист повернено в роботу',
    entityType: 'monthly_route_sheet',
    entityId: id,
    details: `${reopened.vehicleBrand} ${reopened.vehicleModel}; ${reopened.displayVehicleNumber ?? reopened.vehicleNumber}; ${reopened.month}.${reopened.year}`,
    ...metadata,
  });
  return reopened;
}

export async function markMonthlyRouteSheetPrinted(id: string, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const item = await prisma.vehicleMonthlyRouteSheet.findUnique({ where: { id } });
  if (!item || item.isDeleted) throw new AppError('Місячний маршрутний лист не знайдено.', 404);
  assertDepartmentScope(actor, item);
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

export async function getMonthlyRouteSheetPrintData(id: string, actor?: AdminTokenPayload) {
  return getMonthlyRouteSheet(id, actor);
}

export async function deleteMonthlyRouteSheet(id: string, input: Record<string, unknown>, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const data = deletionPayload(input, actor);
  const item = await prisma.vehicleMonthlyRouteSheet.findFirst({ where: { id, isDeleted: false } });
  if (!item) throw new AppError('Місячний маршрутний лист не знайдено.', 404);
  assertDepartmentScope(actor, item);
  const activeShift = await prisma.routeSheet.findFirst({
    where: { monthlyRouteSheetId: id, status: 'active', isDeleted: false },
    select: { id: true },
  });
  if (activeShift) throw new AppError('Неможливо видалити місячний маршрутний лист: є активні незавершені зміни.', 409);
  const deleted = await prisma.vehicleMonthlyRouteSheet.update({ where: { id }, data });
  await createAuditLog({
    action: 'Місячний маршрутний лист видалено',
    entityType: 'monthly_route_sheet',
    entityId: id,
    details: `${deleted.vehicleBrand} ${deleted.vehicleModel}; ${deleted.displayVehicleNumber ?? deleted.vehicleNumber}; причина: ${data.deleteReason}`,
    targetDepartment: deleted.departmentName ?? deleted.department,
    targetDepartmentId: deleted.departmentId,
    targetUnit: deleted.departmentUnitName ?? deleted.unit,
    ...deletionAuditMetadata(actor, metadata),
  });
}
