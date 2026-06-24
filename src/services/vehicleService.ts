import type { CreateVehicleInput, UpdateVehicleInput, Vehicle, VehicleFilters, VehicleTransferHistory } from '../types';
import { normalizeVehicleNumber } from '../utils/vehicleNumber';
import { apiDelete, apiGet, apiPatch, apiPost, isApiUnavailableError } from './apiClient';
import { addAuditLog } from './auditService';
import { extractEntity, extractList } from '../utils/apiResponse';
import { generateId } from '../utils/generateId';
import { routeSheetStorage } from '../storage/routeSheetStorage';

const VEHICLE_STORAGE_KEY = 'patrol-vehicle-directory';
interface VehiclesResponse { success: boolean; vehicles: Vehicle[] }
interface VehicleResponse { success: boolean; vehicle: Vehicle }
interface VehicleTransferHistoryResponse { success: boolean; transferHistory: VehicleTransferHistory[] }

function initialVehicles(): Vehicle[] {
  const now = new Date().toISOString();
  return [{ id: 'local-vehicle-1', plateNumber: 'AA5200MH', displayPlateNumber: 'АА5200МН', brand: 'Hyundai', model: 'Sonata', department: 'УПП у Волинській області', unit: null, isActive: true, createdAt: now, updatedAt: now }];
}

function localVehicles(): Vehicle[] {
  try {
    const stored = localStorage.getItem(VEHICLE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) return parsed as Vehicle[];
    }
  } catch { /* Initialize a clean fallback directory below. */ }
  const vehicles = initialVehicles();
  localStorage.setItem(VEHICLE_STORAGE_KEY, JSON.stringify(vehicles));
  return vehicles;
}
function saveLocalVehicles(vehicles: Vehicle[]) { localStorage.setItem(VEHICLE_STORAGE_KEY, JSON.stringify(vehicles)); }
function queryString(filters: VehicleFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
  return params.size ? `?${params}` : '';
}
function filteredLocalVehicles(filters: VehicleFilters) {
  const search = filters.search?.trim().toLocaleLowerCase('uk-UA');
  const normalized = search ? normalizeVehicleNumber(search) : '';
  return localVehicles().filter((vehicle) => (!search || `${vehicle.brand} ${vehicle.model} ${vehicle.displayPlateNumber}`.toLocaleLowerCase('uk-UA').includes(search) || vehicle.plateNumber.includes(normalized))
    && (!filters.department || vehicle.department.toLocaleLowerCase('uk-UA').includes(filters.department.toLocaleLowerCase('uk-UA')))
    && (!filters.unit || (vehicle.unit ?? '').toLocaleLowerCase('uk-UA').includes(filters.unit.toLocaleLowerCase('uk-UA')))
    && (filters.isActive === undefined || vehicle.isActive === filters.isActive));
}

function withLocalAvailability(vehicles: Vehicle[]): Vehicle[] {
  const activeRouteSheets = routeSheetStorage.getAll().filter((item) => item.status === 'active');
  return vehicles.map((vehicle) => {
    const activeShift = activeRouteSheets.find((item) => item.vehicleNumber === vehicle.plateNumber);
    const startedAt = activeShift ? new Date(activeShift.startedAt) : null;
    return {
      ...vehicle,
      availability: activeShift
        ? {
            status: 'busy',
            activeShiftId: activeShift.id,
            occupiedBy: activeShift.fullName,
            startedAt: activeShift.startedAt,
            monthlyRouteSheetMonth: startedAt ? startedAt.getMonth() + 1 : null,
            monthlyRouteSheetYear: startedAt ? startedAt.getFullYear() : null,
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

export async function getVehicles(filters: VehicleFilters = {}): Promise<Vehicle[]> {
  try { return extractList<Vehicle>(await apiGet<unknown>(`/api/vehicles${queryString(filters)}`), 'vehicles'); }
  catch (error) { if (!isApiUnavailableError(error)) throw error; return filteredLocalVehicles(filters); }
}
export async function getAvailableVehicles(): Promise<Vehicle[]> {
  try { return extractList<Vehicle>(await apiGet<unknown>('/api/vehicles/available'), 'vehicles'); }
  catch (error) { if (!isApiUnavailableError(error)) throw error; return withLocalAvailability(filteredLocalVehicles({ isActive: true })); }
}
export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  try {
    const vehicle = extractEntity<Vehicle>(await apiPost<unknown>('/api/vehicles', input), 'vehicle');
    if (!vehicle) throw new Error('Не вдалося зберегти автомобіль. Некоректна відповідь сервера.');
    return vehicle;
  }
  catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const vehicles = localVehicles();
    const plateNumber = normalizeVehicleNumber(input.displayPlateNumber);
    if (vehicles.some((item) => item.plateNumber === plateNumber)) throw new Error('Автомобіль з таким номерним знаком вже існує');
    const now = new Date().toISOString();
    const vehicle: Vehicle = { ...input, plateNumber, id: generateId('vehicle'), createdAt: now, updatedAt: now };
    saveLocalVehicles([...vehicles, vehicle]);
    await addAuditLog({ action: 'Створено автомобіль', entityType: 'vehicle', entityId: vehicle.id, details: `${vehicle.plateNumber}; ${vehicle.brand} ${vehicle.model}` }).catch(() => undefined);
    return vehicle;
  }
}
export async function updateVehicle(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
  try {
    const vehicle = extractEntity<Vehicle>(await apiPatch<unknown>(`/api/vehicles/${id}`, input), 'vehicle');
    if (!vehicle) throw new Error('Не вдалося зберегти автомобіль. Некоректна відповідь сервера.');
    return vehicle;
  }
  catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const vehicles = localVehicles();
    const index = vehicles.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Автомобіль не знайдено.');
    const updated = { ...vehicles[index], ...input, plateNumber: normalizeVehicleNumber(input.displayPlateNumber ?? vehicles[index].displayPlateNumber ?? vehicles[index].plateNumber), updatedAt: new Date().toISOString() };
    if (vehicles.some((item, itemIndex) => itemIndex !== index && item.plateNumber === updated.plateNumber)) throw new Error('Автомобіль з таким номерним знаком вже існує');
    vehicles[index] = updated;
    saveLocalVehicles(vehicles);
    await addAuditLog({ action: 'Оновлено автомобіль', entityType: 'vehicle', entityId: id, details: `${updated.plateNumber}; ${updated.brand} ${updated.model}` }).catch(() => undefined);
    return updated;
  }
}
export async function deactivateVehicle(id: string, input: { reason?: string; confirmText?: string } = {}): Promise<void> {
  try { await apiDelete(`/api/vehicles/${id}`, input.reason ? input : undefined); }
  catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const vehicles = localVehicles().map((item) => item.id === id ? { ...item, isActive: false, updatedAt: new Date().toISOString() } : item);
    saveLocalVehicles(vehicles);
    await addAuditLog({ action: 'Деактивовано автомобіль', entityType: 'vehicle', entityId: id, details: vehicles.find((item) => item.id === id)?.plateNumber }).catch(() => undefined);
  }
}

export async function transferVehicle(id: string, input: { newDepartmentId?: string | null; newDepartment: string; newDepartmentUnitId?: string | null; newUnit?: string | null; comment?: string | null }): Promise<Vehicle> {
  try {
    const vehicle = extractEntity<Vehicle>(await apiPost<unknown>(`/api/vehicles/${id}/transfer`, input), 'vehicle');
    if (!vehicle) throw new Error('Не вдалося перемістити автомобіль. Некоректна відповідь сервера.');
    return vehicle;
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const vehicles = localVehicles();
    const index = vehicles.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Автомобіль не знайдено.');
    const activeShift = routeSheetStorage.getAll().find((item) => item.vehicleNumber === vehicles[index].plateNumber && item.status === 'active');
    if (activeShift) throw new Error('Неможливо перемістити автомобіль: по ньому є активна незавершена зміна.');
    const updated = {
      ...vehicles[index],
      department: input.newDepartment,
      departmentId: input.newDepartmentId ?? vehicles[index].departmentId ?? null,
      departmentName: input.newDepartment,
      unit: input.newUnit ?? null,
      departmentUnitId: input.newDepartmentUnitId ?? null,
      departmentUnitName: input.newUnit ?? null,
      updatedAt: new Date().toISOString(),
    };
    vehicles[index] = updated;
    saveLocalVehicles(vehicles);
    await addAuditLog({ action: 'Автомобіль переміщено між управліннями', entityType: 'vehicle', entityId: id, details: `${input.newDepartment}${input.newUnit ? ` / ${input.newUnit}` : ''}` }).catch(() => undefined);
    return updated;
  }
}

export async function getVehicleTransferHistory(id: string): Promise<VehicleTransferHistory[]> {
  try {
    return extractList<VehicleTransferHistory>(
      await apiGet<VehicleTransferHistoryResponse>(`/api/vehicles/${encodeURIComponent(id)}/transfer-history`),
      'transferHistory',
    );
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    return [];
  }
}
