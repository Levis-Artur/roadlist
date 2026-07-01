export type FuelType = 'PETROL' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC' | 'OTHER';

export interface Vehicle {
  id: string;
  plateNumber: string;
  displayPlateNumber?: string;
  brand: string;
  model: string;
  fuelType?: FuelType | null;
  fuelConsumptionPer100Km?: number | null;
  fuelTankCapacityLiters?: number | null;
  initialFuelLiters?: number | null;
  department: string;
  unit?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentUnitId?: string | null;
  departmentUnitName?: string | null;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedByAdminId?: string | null;
  deletedByUsername?: string | null;
  deleteReason?: string | null;
  availability?: VehicleAvailability;
  createdAt?: string;
  updatedAt?: string;
}

export interface VehicleAvailability {
  status: 'available' | 'busy';
  activeShiftId: string | null;
  occupiedBy: string | null;
  startedAt: string | null;
  monthlyRouteSheetMonth?: number | null;
  monthlyRouteSheetYear?: number | null;
}

export interface VehicleFilters {
  search?: string;
  department?: string;
  unit?: string;
  departmentId?: string;
  departmentUnitId?: string;
  isActive?: boolean;
}

export interface CreateVehicleInput {
  displayPlateNumber: string;
  brand: string;
  model: string;
  fuelType?: FuelType | null;
  fuelConsumptionPer100Km?: number | null;
  fuelTankCapacityLiters?: number | null;
  initialFuelLiters?: number | null;
  department: string;
  unit?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentUnitId?: string | null;
  departmentUnitName?: string | null;
  isActive: boolean;
}

export type UpdateVehicleInput = Partial<CreateVehicleInput>;

export interface VehicleTransferHistory {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  displayVehicleNumber?: string | null;
  fromDepartment?: string | null;
  fromUnit?: string | null;
  fromDepartmentId?: string | null;
  fromDepartmentName?: string | null;
  fromDepartmentUnitId?: string | null;
  fromDepartmentUnitName?: string | null;
  toDepartment: string;
  toUnit?: string | null;
  toDepartmentId?: string | null;
  toDepartmentName?: string | null;
  toDepartmentUnitId?: string | null;
  toDepartmentUnitName?: string | null;
  comment?: string | null;
  transferredByAdminId?: string | null;
  transferredByUsername?: string | null;
  transferredByRole?: string | null;
  transferredAt: string;
}
