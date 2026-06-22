import type { Vehicle } from '../types';
import { normalizeVehicleNumber } from './vehicleNumber';

export function formatVehicleLabel(vehicle: Vehicle): string {
  return `${vehicle.brand} ${vehicle.model} — ${vehicle.displayPlateNumber || vehicle.plateNumber}`;
}

export function findVehicleByNumber(vehicles: Vehicle[], vehicleNumber: string): Vehicle | undefined {
  const normalized = normalizeVehicleNumber(vehicleNumber);
  return vehicles.find((vehicle) => normalizeVehicleNumber(vehicle.plateNumber) === normalized
    || normalizeVehicleNumber(vehicle.displayPlateNumber ?? '') === normalized);
}
