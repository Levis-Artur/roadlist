import type { RouteSheet } from './routeSheet';

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
