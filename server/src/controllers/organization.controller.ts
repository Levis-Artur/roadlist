import type { NextFunction, Request, Response } from 'express';
import {
  createDepartment,
  createDepartmentUnit,
  listDepartments,
  listDepartmentUnits,
  updateDepartment,
  updateDepartmentUnit,
} from '../services/organization.service.js';

function metadata(request: Request) {
  return {
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
    actorAdminId: request.admin?.adminId,
    actorUsername: request.admin?.username,
    actorRole: request.admin?.role,
    actorDepartment: request.admin?.department ?? null,
    actorUnit: request.admin?.unit ?? null,
    actorDepartmentId: request.admin?.departmentId ?? null,
  };
}

export async function listDepartmentsController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, departments: await listDepartments(request.admin) }); } catch (error) { next(error); }
}

export async function createDepartmentController(request: Request, response: Response, next: NextFunction) {
  try { response.status(201).json({ success: true, department: await createDepartment(request.body ?? {}, metadata(request), request.admin) }); } catch (error) { next(error); }
}

export async function updateDepartmentController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, department: await updateDepartment(request.params.id, request.body ?? {}, metadata(request), request.admin) }); } catch (error) { next(error); }
}

export async function listDepartmentUnitsController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, departmentUnits: await listDepartmentUnits(request.query, request.admin) }); } catch (error) { next(error); }
}

export async function createDepartmentUnitController(request: Request, response: Response, next: NextFunction) {
  try { response.status(201).json({ success: true, departmentUnit: await createDepartmentUnit(request.body ?? {}, metadata(request), request.admin) }); } catch (error) { next(error); }
}

export async function updateDepartmentUnitController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, departmentUnit: await updateDepartmentUnit(request.params.id, request.body ?? {}, metadata(request), request.admin) }); } catch (error) { next(error); }
}
