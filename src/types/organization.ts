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
