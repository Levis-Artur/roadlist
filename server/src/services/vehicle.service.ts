import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AdminTokenPayload, RequestMetadata } from '../types/index.js';
import { normalizeVehicleNumber } from '../utils/normalizeVehicleNumber.js';
import { createAuditLog } from './audit.service.js';

function required(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AppError(message, 400);
  return value.trim();
}

function uniqueVehicleError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError('Автомобіль з таким номерним знаком вже існує', 409);
  }
  throw error;
}

export async function listAvailableVehicles() {
  const vehicles = await prisma.vehicle.findMany({
    where: { isActive: true },
    orderBy: [{ brand: 'asc' }, { model: 'asc' }],
    select: { id: true, plateNumber: true, displayPlateNumber: true, brand: true, model: true, department: true, isActive: true, createdAt: true, updatedAt: true },
  });
  const activeShifts = await prisma.routeSheet.findMany({
    where: { status: 'active', vehicleNumber: { in: vehicles.map((vehicle) => vehicle.plateNumber) } },
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
  return actor?.role === 'REGIONAL_ADMIN' ? actor.department ?? '' : requestedDepartment;
}

function assertDepartmentAccess(actor: AdminTokenPayload | undefined, department: string) {
  if (actor?.role === 'REGIONAL_ADMIN' && department !== actor.department) {
    throw new AppError('Недостатньо прав для доступу до чужого УПП.', 403);
  }
}

export async function listVehicles(filters: Record<string, unknown> = {}, actor?: AdminTokenPayload) {
  const search = typeof filters.search === 'string' ? filters.search.trim() : '';
  const department = scopedDepartment(actor, typeof filters.department === 'string' ? filters.department.trim() : '');
  const isActive = filters.isActive === 'true' ? true : filters.isActive === 'false' ? false : undefined;
  const normalizedSearch = search ? normalizeVehicleNumber(search) : '';
  return prisma.vehicle.findMany({
    where: {
      isActive,
      department: department ? { contains: department, mode: 'insensitive' } : undefined,
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
  const department = required(input.department, 'УПП обов’язкове.');
  assertDepartmentAccess(actor, department);
  try {
    const vehicle = await prisma.vehicle.create({
      data: { plateNumber, displayPlateNumber, brand, model, department, isActive: input.isActive !== false },
    });
    await createAuditLog({ action: 'Створено автомобіль', entityType: 'vehicle', entityId: vehicle.id, details: `${plateNumber}; ${brand} ${model}`, ...metadata });
    return vehicle;
  } catch (error) { uniqueVehicleError(error); }
}

export async function updateVehicle(id: string, input: Record<string, unknown>, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const current = await prisma.vehicle.findUnique({ where: { id } });
  if (!current) throw new AppError('Автомобіль не знайдено.', 404);
  assertDepartmentAccess(actor, current.department);
  const displayPlateNumber = input.displayPlateNumber === undefined
    ? current.displayPlateNumber ?? current.plateNumber
    : required(input.displayPlateNumber, 'Номерний знак обов’язковий.');
  const plateNumber = normalizeVehicleNumber(displayPlateNumber);
  const nextDepartment = input.department === undefined ? current.department : required(input.department, 'УПП обов’язкове.');
  assertDepartmentAccess(actor, nextDepartment);
  try {
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        plateNumber,
        displayPlateNumber,
        brand: input.brand === undefined ? undefined : required(input.brand, 'Марка обов’язкова.'),
        model: input.model === undefined ? undefined : required(input.model, 'Модель обов’язкова.'),
        department: input.department === undefined ? undefined : nextDepartment,
        isActive: input.isActive === undefined ? undefined : Boolean(input.isActive),
      },
    });
    await createAuditLog({ action: 'Оновлено автомобіль', entityType: 'vehicle', entityId: id, details: `${plateNumber}; ${vehicle.brand} ${vehicle.model}`, ...metadata });
    return vehicle;
  } catch (error) { uniqueVehicleError(error); }
}

export async function deactivateVehicle(id: string, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const current = await prisma.vehicle.findUnique({ where: { id } });
  if (!current) throw new AppError('Автомобіль не знайдено.', 404);
  assertDepartmentAccess(actor, current.department);
  await prisma.vehicle.update({ where: { id }, data: { isActive: false } });
  await createAuditLog({ action: 'Деактивовано автомобіль', entityType: 'vehicle', entityId: id, details: current.plateNumber, ...metadata });
}
