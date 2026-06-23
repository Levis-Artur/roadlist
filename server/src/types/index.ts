export type RouteSheetStatus = 'active' | 'completed' | 'needs_review';
export type PhotoType = 'start' | 'end';

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface StartShiftInput {
  badgeNumber: string;
  crewNumber?: string | null;
  vehicleNumber: string;
  startOdometer: number;
  startOcrValue?: number;
  startManualEntry: boolean;
  startPhotoId?: string;
}

export interface FinishShiftInput {
  badgeNumber: string;
  crewNumber?: string | null;
  vehicleNumber: string;
  endOdometer: number;
  endOcrValue?: number;
  endManualEntry: boolean;
  endPhotoId?: string;
  refueled?: boolean;
  fuelLiters?: number | null;
}

export interface RouteSheetFilters {
  status?: string;
  badgeNumber?: string;
  vehicleNumber?: string;
  department?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface AuditLogInput extends RequestMetadata {
  action: string;
  entityType: string;
  entityId?: string;
  badgeNumber?: string;
  details?: string;
}
