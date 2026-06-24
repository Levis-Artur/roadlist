export type RouteSheetStatus = 'active' | 'completed' | 'needs_review' | 'verified';
export type PhotoType = 'start' | 'end';
export type AdminRole = 'SYSTEM_OWNER' | 'NATIONAL_ADMIN' | 'REGIONAL_ADMIN';

export interface AdminTokenPayload {
  adminId: string;
  username: string;
  role: AdminRole;
  department?: string | null;
  unit?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  mustChangePassword?: boolean;
}

export interface AdminTwoFactorPendingPayload {
  adminId: string;
  username: string;
  role: AdminRole;
  department?: string | null;
  unit?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  purpose: 'ADMIN_2FA_PENDING';
  mustChangePassword?: boolean;
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
  actorAdminId?: string;
  actorUsername?: string;
  actorRole?: AdminRole;
  actorDepartment?: string | null;
  actorUnit?: string | null;
  actorDepartmentId?: string | null;
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
  unit?: string;
  departmentId?: string;
  departmentUnitId?: string;
  from?: string;
  to?: string;
  search?: string;
  includeDeleted?: string;
}

export interface AuditLogInput extends RequestMetadata {
  action: string;
  entityType: string;
  entityId?: string;
  badgeNumber?: string;
  details?: string;
  targetAdminId?: string;
  targetRole?: AdminRole;
  targetDepartment?: string | null;
  targetUnit?: string | null;
  targetDepartmentId?: string | null;
}
