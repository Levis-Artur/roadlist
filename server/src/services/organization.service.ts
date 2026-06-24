import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AdminTokenPayload, RequestMetadata } from '../types/index.js';
import { createAuditLog } from './audit.service.js';
import { canIncludeDeleted, deletionAuditMetadata, deletionPayload } from './softDelete.service.js';

const FOREIGN_DEPARTMENT_MESSAGE = 'Недостатньо прав для доступу до даних іншого управління';

function required(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AppError(message, 400);
  return value.trim();
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function isGlobalAdmin(actor?: AdminTokenPayload) {
  return actor?.role === 'SYSTEM_OWNER' || actor?.role === 'NATIONAL_ADMIN';
}

export function assertDepartmentScope(actor: AdminTokenPayload | undefined, record: { departmentId?: string | null; department?: string | null; departmentName?: string | null }) {
  if (actor?.role !== 'REGIONAL_ADMIN') return;
  const actorDepartmentId = actor.departmentId ?? null;
  if (actorDepartmentId && record.departmentId) {
    if (record.departmentId !== actorDepartmentId) throw new AppError(FOREIGN_DEPARTMENT_MESSAGE, 403);
    return;
  }
  const actorDepartment = actor.departmentName || actor.department || '';
  const recordDepartment = record.departmentName || record.department || '';
  if (recordDepartment !== actorDepartment) throw new AppError(FOREIGN_DEPARTMENT_MESSAGE, 403);
}

export function scopedDepartmentWhere(actor?: AdminTokenPayload): Prisma.Enumerable<Prisma.DepartmentWhereInput> | Prisma.DepartmentWhereInput | undefined {
  if (actor?.role !== 'REGIONAL_ADMIN') return undefined;
  if (actor.departmentId) return { id: actor.departmentId };
  return { name: actor.departmentName || actor.department || '' };
}

async function departmentByInput(input: Record<string, unknown>, actor?: AdminTokenPayload) {
  if (actor?.role === 'REGIONAL_ADMIN') {
    const department = actor.departmentId
      ? await prisma.department.findFirst({ where: { id: actor.departmentId, isActive: true, isDeleted: false } })
      : await prisma.department.findFirst({ where: { name: actor.departmentName || actor.department || '', isActive: true, isDeleted: false } });
    if (!department) throw new AppError('Управління регіонального адміністратора не знайдено або неактивне.', 403);
    return department;
  }
  const departmentId = optionalText(input.departmentId);
  if (departmentId) {
    const department = await prisma.department.findFirst({ where: { id: departmentId, isActive: true, isDeleted: false } });
    if (!department) throw new AppError('Управління не знайдено або неактивне.', 404);
    return department;
  }
  const name = optionalText(input.departmentName) || optionalText(input.department);
  if (!name) throw new AppError('Управління обов’язкове.', 400);
  const department = await prisma.department.findFirst({ where: { name, isActive: true, isDeleted: false } });
  if (!department) throw new AppError('Управління не знайдено або неактивне.', 404);
  return department;
}

async function unitByInput(input: Record<string, unknown>, departmentId: string) {
  const departmentUnitId = optionalText(input.departmentUnitId);
  if (departmentUnitId) {
    const unit = await prisma.departmentUnit.findFirst({ where: { id: departmentUnitId, departmentId, isActive: true, isDeleted: false } });
    if (!unit) throw new AppError('Внутрішній підрозділ не знайдено або він належить іншому управлінню.', 404);
    return unit;
  }
  const unitName = optionalText(input.departmentUnitName) || optionalText(input.unit);
  if (!unitName) return null;
  return prisma.departmentUnit.upsert({
    where: { departmentId_name: { departmentId, name: unitName } },
    update: { isActive: true },
    create: { departmentId, name: unitName, isActive: true },
  });
}

export async function resolveDepartmentAssignment(input: Record<string, unknown>, actor?: AdminTokenPayload) {
  const department = await departmentByInput(input, actor);
  assertDepartmentScope(actor, { departmentId: department.id, departmentName: department.name });
  const unit = await unitByInput(input, department.id);
  return {
    departmentId: department.id,
    departmentName: department.name,
    department: department.name,
    departmentUnitId: unit?.id ?? null,
    departmentUnitName: unit?.name ?? null,
    unit: unit?.name ?? null,
  };
}

export async function listDepartments(actor?: AdminTokenPayload, filters: Record<string, unknown> = {}) {
  const where: Prisma.DepartmentWhereInput = {
    ...(scopedDepartmentWhere(actor) as Prisma.DepartmentWhereInput | undefined),
    isDeleted: canIncludeDeleted(actor, filters.includeDeleted) ? undefined : false,
  };
  const departments = await prisma.department.findMany({
    where,
    include: {
      _count: { select: { units: true } },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
  const [vehicles, officers, routeSheets] = await Promise.all([
    prisma.vehicle.groupBy({ by: ['departmentId'], where: { isDeleted: false }, _count: { _all: true } }),
    prisma.officer.groupBy({ by: ['departmentId'], where: { isDeleted: false }, _count: { _all: true } }),
    prisma.routeSheet.groupBy({ by: ['departmentId'], where: { isDeleted: false }, _count: { _all: true } }),
  ]);
  const vehicleCounts = new Map(vehicles.map((item) => [item.departmentId, item._count._all]));
  const officerCounts = new Map(officers.map((item) => [item.departmentId, item._count._all]));
  const routeSheetCounts = new Map(routeSheets.map((item) => [item.departmentId, item._count._all]));
  return departments.map((department) => ({
    ...department,
    unitCount: department._count.units,
    vehicleCount: vehicleCounts.get(department.id) ?? 0,
    officerCount: officerCounts.get(department.id) ?? 0,
    routeSheetCount: routeSheetCounts.get(department.id) ?? 0,
  }));
}

export async function createDepartment(input: Record<string, unknown>, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  if (!isGlobalAdmin(actor)) throw new AppError('Створювати управління може тільки власник системи або національний адміністратор.', 403);
  const name = required(input.name, 'Назва управління обов’язкова.');
  try {
    const department = await prisma.department.create({
      data: { name, code: optionalText(input.code), region: optionalText(input.region), isActive: input.isActive !== false },
    });
    await createAuditLog({ action: 'Створено управління', entityType: 'department', entityId: department.id, details: department.name, targetDepartmentId: department.id, targetDepartment: department.name, ...metadata });
    return department;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('Управління з такою назвою або кодом вже існує.', 409);
    throw error;
  }
}

export async function updateDepartment(id: string, input: Record<string, unknown>, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  if (!isGlobalAdmin(actor)) throw new AppError('Редагувати управління може тільки власник системи або національний адміністратор.', 403);
  const current = await prisma.department.findUnique({ where: { id } });
  if (!current) throw new AppError('Управління не знайдено.', 404);
  const department = await prisma.department.update({
    where: { id },
    data: {
      name: input.name === undefined ? undefined : required(input.name, 'Назва управління обов’язкова.'),
      code: input.code === undefined ? undefined : optionalText(input.code),
      region: input.region === undefined ? undefined : optionalText(input.region),
      isActive: input.isActive === undefined ? undefined : Boolean(input.isActive),
    },
  });
  await createAuditLog({ action: 'Управління оновлено', entityType: 'department', entityId: id, details: department.name, targetDepartmentId: id, targetDepartment: department.name, ...metadata });
  return department;
}

export async function listDepartmentUnits(filters: Record<string, unknown> = {}, actor?: AdminTokenPayload) {
  const requestedDepartmentId = optionalText(filters.departmentId);
  const where: Prisma.DepartmentUnitWhereInput = {
    isDeleted: canIncludeDeleted(actor, filters.includeDeleted) ? undefined : false,
  };
  if (actor?.role === 'REGIONAL_ADMIN') {
    where.departmentId = actor.departmentId || '__none__';
  } else if (requestedDepartmentId) {
    where.departmentId = requestedDepartmentId;
  }
  if (filters.isActive === 'true') where.isActive = true;
  if (filters.isActive === 'false') where.isActive = false;
  return prisma.departmentUnit.findMany({
    where,
    include: { department: true },
    orderBy: [{ department: { name: 'asc' } }, { isActive: 'desc' }, { name: 'asc' }],
  });
}

export async function createDepartmentUnit(input: Record<string, unknown>, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const department = await departmentByInput(input, actor);
  assertDepartmentScope(actor, { departmentId: department.id, departmentName: department.name });
  try {
    const unit = await prisma.departmentUnit.create({
      data: {
        departmentId: department.id,
        name: required(input.name, 'Назва внутрішнього підрозділу обов’язкова.'),
        type: optionalText(input.type),
        code: optionalText(input.code),
        description: optionalText(input.description),
        isActive: input.isActive !== false,
      },
      include: { department: true },
    });
    await createAuditLog({ action: 'Створено внутрішній підрозділ', entityType: 'department_unit', entityId: unit.id, details: `${department.name}; ${unit.name}`, targetDepartmentId: department.id, targetDepartment: department.name, targetUnit: unit.name, ...metadata });
    return unit;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('Такий внутрішній підрозділ вже існує в цьому управлінні.', 409);
    throw error;
  }
}

export async function updateDepartmentUnit(id: string, input: Record<string, unknown>, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const current = await prisma.departmentUnit.findFirst({ where: { id, isDeleted: false }, include: { department: true } });
  if (!current) throw new AppError('Внутрішній підрозділ не знайдено.', 404);
  assertDepartmentScope(actor, { departmentId: current.departmentId, departmentName: current.department.name });
  const unit = await prisma.departmentUnit.update({
    where: { id },
    data: {
      name: input.name === undefined ? undefined : required(input.name, 'Назва внутрішнього підрозділу обов’язкова.'),
      type: input.type === undefined ? undefined : optionalText(input.type),
      code: input.code === undefined ? undefined : optionalText(input.code),
      description: input.description === undefined ? undefined : optionalText(input.description),
      isActive: input.isActive === undefined ? undefined : Boolean(input.isActive),
    },
    include: { department: true },
  });
  await createAuditLog({ action: 'Внутрішній підрозділ оновлено', entityType: 'department_unit', entityId: id, details: `${unit.department.name}; ${unit.name}`, targetDepartmentId: unit.departmentId, targetDepartment: unit.department.name, targetUnit: unit.name, ...metadata });
  return unit;
}

export async function deleteDepartment(id: string, input: Record<string, unknown>, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const data = deletionPayload(input, actor);
  const current = await prisma.department.findFirst({ where: { id, isDeleted: false } });
  if (!current) throw new AppError('Управління не знайдено.', 404);
  const activeShift = await prisma.routeSheet.findFirst({
    where: {
      status: 'active',
      isDeleted: false,
      OR: [{ departmentId: id }, { department: current.name }, { departmentName: current.name }],
    },
    select: { id: true },
  });
  if (activeShift) throw new AppError('Неможливо видалити управління: є активні незавершені зміни.', 409);
  const department = await prisma.department.update({
    where: { id },
    data: { ...data, isActive: false },
  });
  await createAuditLog({
    action: 'Управління видалено',
    entityType: 'department',
    entityId: id,
    details: `${department.name}; причина: ${data.deleteReason}`,
    targetDepartmentId: id,
    targetDepartment: department.name,
    ...deletionAuditMetadata(actor, metadata),
  });
}

export async function deleteDepartmentUnit(id: string, input: Record<string, unknown>, metadata: RequestMetadata = {}, actor?: AdminTokenPayload) {
  const data = deletionPayload(input, actor);
  const current = await prisma.departmentUnit.findFirst({ where: { id, isDeleted: false }, include: { department: true } });
  if (!current) throw new AppError('Внутрішній підрозділ не знайдено.', 404);
  const unit = await prisma.departmentUnit.update({
    where: { id },
    data: { ...data, isActive: false },
    include: { department: true },
  });
  await createAuditLog({
    action: 'Внутрішній підрозділ видалено',
    entityType: 'department_unit',
    entityId: id,
    details: `${unit.department.name}; ${unit.name}; причина: ${data.deleteReason}`,
    targetDepartmentId: unit.departmentId,
    targetDepartment: unit.department.name,
    targetUnit: unit.name,
    ...deletionAuditMetadata(actor, metadata),
  });
}
