export interface Officer {
  id?: string;
  badgeNumber: string;
  fullName: string;
  department: string;
  unit?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentUnitId?: string | null;
  departmentUnitName?: string | null;
  isActive?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedByAdminId?: string | null;
  deletedByUsername?: string | null;
  deleteReason?: string | null;
  hasPin?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OfficerFilters { search?: string; department?: string; unit?: string; departmentId?: string; departmentUnitId?: string; isActive?: boolean }
export interface CreateOfficerInput { badgeNumber: string; fullName: string; department: string; unit?: string | null; departmentId?: string | null; departmentName?: string | null; departmentUnitId?: string | null; departmentUnitName?: string | null; pin: string; isActive: boolean }
export type UpdateOfficerInput = Partial<CreateOfficerInput>;

export type RouteSheetStatus = 'active' | 'completed' | 'needs_review' | 'verified';
export type AdminRole = 'SYSTEM_OWNER' | 'NATIONAL_ADMIN' | 'REGIONAL_ADMIN';

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  role: AdminRole;
  department?: string | null;
  unit?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedByAdminId?: string | null;
  deletedByUsername?: string | null;
  deleteReason?: string | null;
  mustChangePassword?: boolean;
  passwordChangedAt?: string | null;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  twoFactorEnabled?: boolean;
  twoFactorEnabledAt?: string | null;
  twoFactorLastVerifiedAt?: string | null;
  createdById?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RouteSheetFilters {
  status?: RouteSheetStatus;
  search?: string;
  department?: string;
  unit?: string;
  departmentId?: string;
  departmentUnitId?: string;
}

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

export interface VehicleFilters { search?: string; department?: string; unit?: string; departmentId?: string; departmentUnitId?: string; isActive?: boolean }
export type FuelType = 'PETROL' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC' | 'OTHER';
export interface CreateVehicleInput { displayPlateNumber: string; brand: string; model: string; fuelType?: FuelType | null; fuelConsumptionPer100Km?: number | null; fuelTankCapacityLiters?: number | null; initialFuelLiters?: number | null; department: string; unit?: string | null; departmentId?: string | null; departmentName?: string | null; departmentUnitId?: string | null; departmentUnitName?: string | null; isActive: boolean }
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

export interface RouteSheet {
  id: string;
  monthlyRouteSheetId?: string | null;
  badgeNumber: string;
  fullName: string;
  department: string;
  unit?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentUnitId?: string | null;
  departmentUnitName?: string | null;
  crewNumber?: string | null;
  vehicleId?: string | null;
  vehicleNumber: string;
  displayVehicleNumber?: string | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  startOdometer: number;
  endOdometer?: number;
  distanceKm?: number;
  startPhotoId?: string;
  endPhotoId?: string;
  startOcrValue?: number;
  endOcrValue?: number;
  startManualEntry: boolean;
  endManualEntry?: boolean;
  refueled?: boolean;
  fuelLiters?: number | null;
  adminVerifiedAt?: string | null;
  adminVerifiedBy?: string | null;
  adminReviewComment?: string | null;
  status: RouteSheetStatus;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedByAdminId?: string | null;
  deletedByUsername?: string | null;
  deleteReason?: string | null;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OdometerResult {
  value: number;
  ocrValue?: number;
  manualEntry: boolean;
  photoId?: string;
}

export interface StartShiftInput {
  officer: Officer;
  crewNumber?: string | null;
  vehicleNumber: string;
  startOdometer: number;
  startPhotoId?: string;
  startOcrValue?: number;
  startManualEntry: boolean;
}

export interface FinishShiftInput {
  badgeNumber: string;
  crewNumber?: string | null;
  vehicleNumber: string;
  endOdometer: number;
  endPhotoId?: string;
  endOcrValue?: number;
  endManualEntry: boolean;
  refueled?: boolean;
  fuelLiters?: number | null;
}

export type MonthlyRouteSheetStatus = 'open' | 'closed' | 'archived';

export interface MonthlyRouteSheet {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  displayVehicleNumber?: string | null;
  vehicleBrand: string;
  vehicleModel: string;
  department: string;
  unit?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentUnitId?: string | null;
  departmentUnitName?: string | null;
  year: number;
  month: number;
  status: MonthlyRouteSheetStatus;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedByAdminId?: string | null;
  deletedByUsername?: string | null;
  deleteReason?: string | null;
  openingOdometer?: number | null;
  closingOdometer?: number | null;
  totalDistanceKm: number;
  totalFuelLiters: number;
  printedAt?: string | null;
  closedAt?: string | null;
  archivedAt?: string | null;
  adminCheckedBy?: string | null;
  adminComment?: string | null;
  fuelSummary?: MonthlyFuelSummary;
  shiftCount?: number;
  shiftEntries?: RouteSheet[];
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyFuelSummary {
  totalDistanceKm: number;
  totalRefueledLiters: number;
  fuelConsumptionPer100Km: number | null;
  fuelTankCapacityLiters: number | null;
  estimatedFuelUsedLiters: number | null;
  initialFuelLiters: number | null;
  estimatedFuelBalanceLiters: number | null;
  fuelWarnings: string[];
}

export interface MonthlyRouteSheetFilters {
  year?: number;
  month?: number;
  vehicleId?: string;
  status?: MonthlyRouteSheetStatus;
  department?: string;
  unit?: string;
  departmentId?: string;
  departmentUnitId?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  badgeNumber?: string;
  details?: string;
  actorUnit?: string | null;
  targetUnit?: string | null;
  actorDepartmentId?: string | null;
  targetDepartmentId?: string | null;
  createdAt: string;
}

export type AddAuditLogInput = Omit<AuditLog, 'id' | 'createdAt'>;

export interface Department {
  id: string;
  name: string;
  code?: string | null;
  region?: string | null;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedByAdminId?: string | null;
  deletedByUsername?: string | null;
  deleteReason?: string | null;
  unitCount?: number;
  vehicleCount?: number;
  officerCount?: number;
  routeSheetCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepartmentUnit {
  id: string;
  departmentId: string;
  name: string;
  type?: string | null;
  code?: string | null;
  description?: string | null;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedByAdminId?: string | null;
  deletedByUsername?: string | null;
  deleteReason?: string | null;
  department?: Department;
  createdAt?: string;
  updatedAt?: string;
}
