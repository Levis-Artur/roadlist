import type { Officer } from './officer';

export type RouteSheetStatus = 'active' | 'completed' | 'needs_review' | 'verified';

export interface RouteSheetFilters {
  status?: RouteSheetStatus;
  search?: string;
  department?: string;
  unit?: string;
  departmentId?: string;
  departmentUnitId?: string;
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
