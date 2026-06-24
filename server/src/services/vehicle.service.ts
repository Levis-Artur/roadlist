import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AdminTokenPayload, RequestMetadata } from '../types/index.js';
import { normalizeVehicleNumber } from '../utils/normalizeVehicleNumber.js';
import { createAuditLog } from './audit.service.js';
import { assertDepartmentScope, resolveDepartmentAssignment } from './organization.service.js';
import { canIncludeDeleted, deletionAuditMetadata, deletionPayload } from './softDelete.service.js';

const FOREIGN_DEPARTMENT_MESSAGE = 'Недостатньо прав для доступу до даних іншого управління';

function required(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AppError(message, 400);
  return value.trim();
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function uniqueVehicleError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError('Автомобіль з таким номерним знаком вже існує', 409);
  }
  throw error;
}

export async function listAvailableVehicles() {
  const vehicles = await prisma.vehicle.findMany({
    where: { isActive: true, isDeleted: false },
    orderBy: [{ brand: 'asc' }, { model: 'asc' }],
    select: { id: true, plateNumber: true, displayPlateNumber: true, brand: true, model: true, department: true, unit: true, departmentId: true, departmentName: true, departmentUnitId: true, departmentUnitName: true, isActive: true, createdAt: true, updatedAt: true },
  });
  const activeShifts = await prisma.routeSheet.findMany({
    where: { status: 'active', isDeleted: false, vehicleNumber: { in: vehicles.map((vehicle) => vehicle.plateNumber) } },
    select: {
      id: true,
      vehicleNumber: true,
      fullName: true,
      startedAt: true,
      monthlyRouteSheet: { select: { month: true, year: true } },
    },
  });
  const activeByVehicle = new Map(activeShifts.map((shift) => [shift.vehicleNumber, shift]));
  return vehicles.map((vehicle) => {
    const activeShift = activeByVehicle.get(vehicle.plateNumber);
    return {
      ...vehicle,
      availability: activeShift
        ? {
            status: 'busy',
            activeShiftId: activeShift.id,
            occupiedBy: activeShift.fullName,
            startedAt: activeShift.startedAt,
            monthlyRouteSheetMonth: activeShift.monthlyRouteSheet?.month ?? activeShift.startedAt.getMonth() + 1,
            monthlyRouteSheetYear: activeShift.monthlyRouteSheet?.year ?? activeShift.startedAt.getFullYear(),
          }
        : {
            status: 'available',
            activeShiftId: null,
            occupiedBy: null,
            startedAt: null,
            monthlyRouteSheetMonth: null,
            monthlyRouteSheetYear: null,
          },
    };
  });
}

function scopedDepartment(actor?: AdminTokenPayload, requestedDepartment?: string) {
  return actor?.role === 'REGIONAL_ADMIN' ? actor.departmentName ?? actor.department ?? '' : requestedDepartment;
}

function assertDepartmentAccess(actor: AdminTokenPayload | undefined, department: string) {
  if (actor?.role === 'REGIONAL_ADMIN' && department !== (actor.departmentName ?? actor.department)) {
    throw new AppError(FOREIGN_DEPARTMENT_MESSAGE, 403);
  }
}

export async function listVehicles(filters: Record<string, unknown> = {}, actor?: AdminTokenPayload) {
  const search = typeof filters.search === 'string' ? filters.search.trim() : '';
  const department = scopedDepartment(actor, typeof filters.department === 'string' ? filters.department.trim() : '');
  const departmentId = actor?.role === 'REGIONAL_ADMIN'
    ? actor.departmentId ?? ''
    : typeof filters.departmentId === 'string' ? filters.departmentId.trim() : '';
  const unit = typeof filters.unit === 'string' ? filters.unit.trim() : '';
  const departmentUnitId = typeof filters.departmentUnitId === 'string' ? filters.departmentUnitId.trim() : '';
  const isActive = filters.isActive === 'true' ? true : filters.isActive === 'false' ? false : undefined;
  const normalizedSearch = search ? normalizeVehicleNumber(search) : '';
  return prisma.vehicle.findMany({
    where: {
      isActive,
      isDeleted: canIncludeDeleted(actor, filters.includeDeleted) ? undefined : false,
      departmentId: departmentId || undefined,
      departmentUnitId: departmentUnitId || undefined,
      department: department ? { contains: department, mode: 'insensitive' } : undefined,
      unit: unit ? { contains: unit, mode: 'insensitive' } : undefined,
      OR: search ? [
        { plateNumber: { contains: normalizedSearch } },
        { displayPlateNumber: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ] : undefined,
    },
    orderBy: [{ isActive: 'desc' }, { plateNumber: 'asc' }],
  });
}

export async function createVehicle(input: Record<string, unknown>, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const displayPlateNumber = required(input.displayPlateNumber, 'Номерний знак обов’язковий.');
  const plateNumber = normalizeVehicleNumber(displayPlateNumber);
  const brand = required(input.brand, 'Марка обов’язкова.');
  const model = required(input.model, 'Модель обов’язкова.');
  const assignment = await resolveDepartmentAssignment(input, actor);
  try {
    const vehicle = await prisma.vehicle.create({
      data: { plateNumber, displayPlateNumber, brand, model, ...assignment, isActive: input.isActive !== false },
    });
    await createAuditLog({ action: 'Створено автомобіль', entityType: 'vehicle', entityId: vehicle.id, details: `${plateNumber}; ${brand} ${model}`, targetDepartment: vehicle.department, targetDepartmentId: vehicle.departmentId, targetUnit: vehicle.unit, ...metadata });
    return vehicle;
  } catch (error) { uniqueVehicleError(error); }
}

export async function updateVehicle(id: string, input: Record<string, unknown>, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const current = await prisma.vehicle.findFirst({ where: { id, isDeleted: false } });
  if (!current) throw new AppError('Автомобіль не знайдено.', 404);
  assertDepartmentScope(actor, current);
  const displayPlateNumber = input.displayPlateNumber === undefined
    ? current.displayPlateNumber ?? current.plateNumber
    : required(input.displayPlateNumber, 'Номерний знак обов’язковий.');
  const plateNumber = normalizeVehicleNumber(displayPlateNumber);
  const assignment = input.department === undefined && input.departmentId === undefined && input.departmentName === undefined && input.unit === undefined && input.departmentUnitId === undefined && input.departmentUnitName === undefined
    ? {}
    : await resolveDepartmentAssignment({ department: current.department, departmentId: current.departmentId, departmentName: current.departmentName, departmentUnitId: current.departmentUnitId, departmentUnitName: current.departmentUnitName, unit: current.unit, ...input }, actor);
  try {
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        plateNumber,
        displayPlateNumber,
        brand: input.brand === undefined ? undefined : required(input.brand, 'Марка обов’язкова.'),
        model: input.model === undefined ? undefined : required(input.model, 'Модель обов’язкова.'),
        ...assignment,
        isActive: input.isActive === undefined ? undefined : Boolean(input.isActive),
      },
    });
    await createAuditLog({ action: 'Оновлено автомобіль', entityType: 'vehicle', entityId: id, details: `${plateNumber}; ${vehicle.brand} ${vehicle.model}`, targetDepartment: vehicle.department, targetUnit: vehicle.unit, ...metadata });
    return vehicle;
  } catch (error) { uniqueVehicleError(error); }
}

export async function deactivateVehicle(id: string, input: Record<string, unknown> = {}, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const data = deletionPayload(input, actor);
  const current = await prisma.vehicle.findFirst({ where: { id, isDeleted: false } });
  if (!current) throw new AppError('Автомобіль не знайдено.', 404);
  const activeShift = await prisma.routeSheet.findFirst({
    where: { vehicleNumber: current.plateNumber, status: 'active', isDeleted: false },
    select: { id: true },
  });
  if (activeShift) throw new AppError('Неможливо видалити автомобіль: по ньому є активна незавершена зміна.', 409);
  await prisma.vehicle.update({ where: { id }, data: { ...data, isActive: false } });
  await createAuditLog({
    action: 'Автомобіль видалено',
    entityType: 'vehicle',
    entityId: id,
    details: `${current.plateNumber}; причина: ${data.deleteReason}`,
    targetDepartment: current.department,
    targetDepartmentId: current.departmentId,
    targetUnit: current.unit,
    ...deletionAuditMetadata(actor, metadata),
  });
}

export async function transferVehicle(id: string, input: Record<string, unknown>, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  if (!actor) throw new AppError('Потрібна авторизація адміністратора.', 401);
  const current = await prisma.vehicle.findFirst({ where: { id, isDeleted: false } });
  if (!current) throw new AppError('Автомобіль не знайдено.', 404);
  assertDepartmentScope(actor, current);
  const activeShift = await prisma.routeSheet.findFirst({
    where: { vehicleNumber: current.plateNumber, status: 'active', isDeleted: false },
    select: { id: true },
  });
  if (activeShift) {
    throw new AppError('Неможливо перемістити автомобіль: по ньому є активна незавершена зміна.', 409);
  }
  const assignment = await resolveDepartmentAssignment({
    departmentId: input.newDepartmentId ?? input.departmentId,
    departmentName: input.newDepartmentName ?? input.newDepartment,
    department: input.newDepartment ?? input.department,
    departmentUnitId: input.newDepartmentUnitId ?? input.departmentUnitId,
    departmentUnitName: input.newDepartmentUnitName ?? input.newUnit,
    unit: input.newUnit ?? input.unit,
  }, actor);
  if (actor.role === 'REGIONAL_ADMIN' && assignment.departmentId !== (actor.departmentId ?? current.departmentId)) {
    throw new AppError('Регіональний адміністратор може переміщати авто тільки між підрозділами свого управління.', 403);
  }
  const comment = optionalText(input.comment);
  const updated = await prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.update({
      where: { id },
      data: assignment,
    });
    await tx.vehicleTransferHistory.create({
      data: {
        vehicleId: id,
        vehicleNumber: current.plateNumber,
        displayVehicleNumber: current.displayPlateNumber,
        fromDepartment: current.department,
        fromUnit: current.unit,
        fromDepartmentId: current.departmentId,
        fromDepartmentName: current.departmentName ?? current.department,
        fromDepartmentUnitId: current.departmentUnitId,
        fromDepartmentUnitName: current.departmentUnitName ?? current.unit,
        toDepartment: assignment.department,
        toUnit: assignment.unit,
        toDepartmentId: assignment.departmentId,
        toDepartmentName: assignment.departmentName,
        toDepartmentUnitId: assignment.departmentUnitId,
        toDepartmentUnitName: assignment.departmentUnitName,
        comment,
        transferredByAdminId: actor.adminId,
        transferredByUsername: actor.username,
        transferredByRole: actor.role,
      },
    });
    return vehicle;
  });
  await createAuditLog({
    action: 'Автомобіль переміщено між управліннями',
    entityType: 'vehicle',
    entityId: id,
    details: `${current.departmentName ?? current.department}${current.departmentUnitName ?? current.unit ? ` / ${current.departmentUnitName ?? current.unit}` : ''} → ${assignment.departmentName}${assignment.departmentUnitName ? ` / ${assignment.departmentUnitName}` : ''}${comment ? `; ${comment}` : ''}`,
    targetDepartment: assignment.departmentName,
    targetDepartmentId: assignment.departmentId,
    targetUnit: assignment.departmentUnitName,
    ...metadata,
  });
  return updated;
}

export async function listVehicleTransferHistory(id: string, actor?: AdminTokenPayload) {
  const vehicle = await prisma.vehicle.findFirst({ where: { id, isDeleted: false } });
  if (!vehicle) throw new AppError('Автомобіль не знайдено.', 404);
  assertDepartmentScope(actor, vehicle);
  return prisma.vehicleTransferHistory.findMany({ where: { vehicleId: id }, orderBy: { transferredAt: 'desc' } });
}
