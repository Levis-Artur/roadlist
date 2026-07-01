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
