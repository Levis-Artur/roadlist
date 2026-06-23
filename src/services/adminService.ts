import type { AdminRole, AdminUser } from '../types';
import { apiDelete, apiGet, apiPatch, apiPost } from './apiClient';

const ADMIN_TOKEN_KEY = 'admin_token';
const ADMIN_SESSION_KEY = 'admin_user';
const LEGACY_AUTH_KEY = 'admin_authenticated';

interface AdminLoginResponse {
  success: boolean;
  token?: string;
  admin?: AdminUser;
}

interface AdminListResponse {
  success: boolean;
  admins: AdminUser[];
}

interface AdminResponse {
  success: boolean;
  admin: AdminUser;
}

export const adminRoleLabels: Record<AdminRole, string> = {
  SYSTEM_OWNER: 'Власник системи',
  NATIONAL_ADMIN: 'Національний адміністратор',
  REGIONAL_ADMIN: 'Регіональний адміністратор',
};

export async function loginAdmin(username: string, password: string): Promise<boolean> {
  const response = await apiPost<AdminLoginResponse>('/api/admin/login', { username, password });
  if (!response.success || !response.token || !response.admin) return false;
  sessionStorage.setItem(ADMIN_TOKEN_KEY, response.token);
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(response.admin));
  sessionStorage.removeItem(LEGACY_AUTH_KEY);
  return true;
}

export function logoutAdmin(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(LEGACY_AUTH_KEY);
}

export function isAdminAuthenticated(): boolean {
  return Boolean(getAdminToken() && getCurrentAdmin());
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getCurrentAdmin(): AdminUser | null {
  try {
    return JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || 'null') as AdminUser | null;
  } catch {
    return null;
  }
}

export function canManageAdminUsers(admin: AdminUser | null): boolean {
  return admin?.role === 'SYSTEM_OWNER' || admin?.role === 'NATIONAL_ADMIN';
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const response = await apiGet<AdminListResponse>('/api/admin/users');
  return response.admins;
}

export async function createAdminUser(input: {
  username: string;
  fullName: string;
  role: AdminRole;
  department?: string | null;
  password: string;
  isActive: boolean;
}): Promise<AdminUser> {
  return (await apiPost<AdminResponse>('/api/admin/users', input)).admin;
}

export async function updateAdminUser(id: string, input: Partial<{
  username: string;
  fullName: string;
  role: AdminRole;
  department?: string | null;
  password: string;
  isActive: boolean;
}>): Promise<AdminUser> {
  return (await apiPatch<AdminResponse>(`/api/admin/users/${encodeURIComponent(id)}`, input)).admin;
}

export async function deactivateAdminUser(id: string): Promise<void> {
  await apiDelete(`/api/admin/users/${encodeURIComponent(id)}`);
}
