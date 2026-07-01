import type { CreateVehicleInput, UpdateVehicleInput, Vehicle, VehicleFilters, VehicleTransferHistory } from '../types';
import { apiDelete, apiGet, apiPatch, apiPost } from './apiClient';
import { extractEntity, extractList } from '../utils/apiResponse';

interface VehicleTransferHistoryResponse {
  success: boolean;
  transferHistory: VehicleTransferHistory[];
}

function queryString(filters: VehicleFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.size ? `?${params}` : '';
}

export async function getVehicles(filters: VehicleFilters = {}): Promise<Vehicle[]> {
  return extractList<Vehicle>(await apiGet<unknown>(`/api/vehicles${queryString(filters)}`, { auth: 'admin' }), 'vehicles');
}

export async function getAvailableVehicles(): Promise<Vehicle[]> {
  return extractList<Vehicle>(await apiGet<unknown>('/api/vehicles/available', { auth: 'officer' }), 'vehicles');
}

export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  const vehicle = extractEntity<Vehicle>(await apiPost<unknown>('/api/vehicles', input, { auth: 'admin' }), 'vehicle');
  if (!vehicle) throw new Error('Не вдалося зберегти автомобіль. Некоректна відповідь сервера.');
  return vehicle;
}

export async function updateVehicle(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
  const vehicle = extractEntity<Vehicle>(await apiPatch<unknown>(`/api/vehicles/${id}`, input, { auth: 'admin' }), 'vehicle');
  if (!vehicle) throw new Error('Не вдалося зберегти автомобіль. Некоректна відповідь сервера.');
  return vehicle;
}

export async function deactivateVehicle(id: string, input: { reason?: string; confirmText?: string } = {}): Promise<void> {
  await apiDelete(`/api/vehicles/${id}`, input.reason ? input : undefined, { auth: 'admin' });
}

export async function transferVehicle(id: string, input: {
  newDepartmentId?: string | null;
  newDepartment: string;
  newDepartmentUnitId?: string | null;
  newUnit?: string | null;
  comment?: string | null;
}): Promise<Vehicle> {
  const vehicle = extractEntity<Vehicle>(await apiPost<unknown>(`/api/vehicles/${id}/transfer`, input, { auth: 'admin' }), 'vehicle');
  if (!vehicle) throw new Error('Не вдалося перемістити автомобіль. Некоректна відповідь сервера.');
  return vehicle;
}

export async function getVehicleTransferHistory(id: string): Promise<VehicleTransferHistory[]> {
  return extractList<VehicleTransferHistory>(
    await apiGet<VehicleTransferHistoryResponse>(`/api/vehicles/${encodeURIComponent(id)}/transfer-history`, { auth: 'admin' }),
    'transferHistory',
  );
}
