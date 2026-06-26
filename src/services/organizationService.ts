import type { Department, DepartmentUnit } from '../types';
import { extractEntity, extractList } from '../utils/apiResponse';
import { apiDelete, apiGet, apiPatch, apiPost } from './apiClient';

interface DepartmentsResponse { success: boolean; departments: Department[] }
interface DepartmentResponse { success: boolean; department: Department }
interface DepartmentUnitsResponse { success: boolean; departmentUnits: DepartmentUnit[] }
interface DepartmentUnitResponse { success: boolean; departmentUnit: DepartmentUnit }

function queryString(filters: Record<string, unknown> = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.size ? `?${params}` : '';
}

export async function getDepartments(): Promise<Department[]> {
  return extractList<Department>(await apiGet<DepartmentsResponse>('/api/departments'), 'departments');
}

export async function createDepartment(input: { name: string; code?: string | null; region?: string | null; isActive?: boolean }): Promise<Department> {
  const department = extractEntity<Department>(await apiPost<DepartmentResponse>('/api/departments', input), 'department');
  if (!department) throw new Error('Не вдалося створити управління.');
  return department;
}

export async function updateDepartment(id: string, input: Partial<{ name: string; code: string | null; region: string | null; isActive: boolean }>): Promise<Department> {
  const department = extractEntity<Department>(await apiPatch<DepartmentResponse>(`/api/departments/${encodeURIComponent(id)}`, input), 'department');
  if (!department) throw new Error('Не вдалося оновити управління.');
  return department;
}

export async function deleteDepartment(id: string, input: { reason: string; confirmText: string }): Promise<void> {
  await apiDelete(`/api/departments/${encodeURIComponent(id)}`, input);
}

export async function getDepartmentUnits(filters: { departmentId?: string; isActive?: boolean } = {}): Promise<DepartmentUnit[]> {
  return extractList<DepartmentUnit>(await apiGet<DepartmentUnitsResponse>(`/api/department-units${queryString(filters)}`), 'departmentUnits');
}

export async function createDepartmentUnit(input: { departmentId: string; name: string; type?: string | null; code?: string | null; description?: string | null; isActive?: boolean }): Promise<DepartmentUnit> {
  const unit = extractEntity<DepartmentUnit>(await apiPost<DepartmentUnitResponse>('/api/department-units', input), 'departmentUnit');
  if (!unit) throw new Error('Не вдалося створити внутрішній підрозділ.');
  return unit;
}

export async function updateDepartmentUnit(id: string, input: Partial<{ name: string; type: string | null; code: string | null; description: string | null; isActive: boolean }>): Promise<DepartmentUnit> {
  const unit = extractEntity<DepartmentUnit>(await apiPatch<DepartmentUnitResponse>(`/api/department-units/${encodeURIComponent(id)}`, input), 'departmentUnit');
  if (!unit) throw new Error('Не вдалося оновити внутрішній підрозділ.');
  return unit;
}

export async function deleteDepartmentUnit(id: string, input: { reason: string; confirmText: string }): Promise<void> {
  await apiDelete(`/api/department-units/${encodeURIComponent(id)}`, input);
}
