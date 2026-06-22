export interface Officer {
  id?: string;
  badgeNumber: string;
  fullName: string;
  department: string;
  isActive?: boolean;
  hasPin?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OfficerFilters { search?: string; department?: string; isActive?: boolean }
export interface CreateOfficerInput { badgeNumber: string; fullName: string; department: string; pin: string; isActive: boolean }
export type UpdateOfficerInput = Partial<CreateOfficerInput>;

export type RouteSheetStatus = 'active' | 'completed' | 'needs_review';

export interface RouteSheetFilters {
  status?: RouteSheetStatus;
  search?: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  displayPlateNumber?: string;
  brand: string;
  model: string;
  department: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface VehicleFilters { search?: string; department?: string; isActive?: boolean }
export interface CreateVehicleInput { displayPlateNumber: string; brand: string; model: string; department: string; isActive: boolean }
export type UpdateVehicleInput = Partial<CreateVehicleInput>;

export interface RouteSheet {
  id: string;
  badgeNumber: string;
  fullName: string;
  department: string;
  crewNumber?: string | null;
  vehicleNumber: string;
  startOdometer: number;
  endOdometer?: number;
  distanceKm?: number;
  startPhotoId?: string;
  endPhotoId?: string;
  startOcrValue?: number;
  endOcrValue?: number;
  startManualEntry: boolean;
  endManualEntry?: boolean;
  status: RouteSheetStatus;
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
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: 'route_sheet' | 'photo' | 'admin' | 'officer' | 'vehicle';
  entityId?: string;
  badgeNumber?: string;
  details?: string;
  createdAt: string;
}

export type AddAuditLogInput = Omit<AuditLog, 'id' | 'createdAt'>;
