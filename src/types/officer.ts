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

export interface OfficerFilters {
  search?: string;
  department?: string;
  unit?: string;
  departmentId?: string;
  departmentUnitId?: string;
  isActive?: boolean;
}

export interface CreateOfficerInput {
  badgeNumber: string;
  fullName: string;
  department: string;
  unit?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentUnitId?: string | null;
  departmentUnitName?: string | null;
  pin: string;
  isActive: boolean;
}

export type UpdateOfficerInput = Partial<CreateOfficerInput>;
