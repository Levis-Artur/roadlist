import type { AdminRole, AdminUser } from '../types';
import { ApiUnavailableError, apiDelete, apiGet, apiPatch, apiPost, getApiUrl } from './apiClient';

const ADMIN_TOKEN_KEY = 'admin_token';
const ADMIN_PENDING_TOKEN_KEY = 'admin_2fa_pending_token';
const ADMIN_SESSION_KEY = 'admin_user';
const LEGACY_AUTH_KEY = 'admin_authenticated';

interface AdminLoginResponse {
  success: boolean;
  token?: string;
  temporaryToken?: string;
  mustChangePassword?: boolean;
  requiresTwoFactor?: boolean;
  requiresTwoFactorSetup?: boolean;
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

export async function loginAdmin(username: string, password: string): Promise<AdminLoginResponse> {
  const response = await apiPost<AdminLoginResponse>('/api/admin/login', { username, password });
  if (response.temporaryToken) sessionStorage.setItem(ADMIN_PENDING_TOKEN_KEY, response.temporaryToken);
  if (response.token && response.admin) finishAdminLogin(response.token, response.admin);
  sessionStorage.removeItem(LEGACY_AUTH_KEY);
  return response;
}

export function finishAdminLogin(token: string, admin: AdminUser): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(admin));
  sessionStorage.removeItem(ADMIN_PENDING_TOKEN_KEY);
}

export function logoutAdmin(): void {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) {
    fetch(getApiUrl('/api/admin/logout'), {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_PENDING_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(LEGACY_AUTH_KEY);
}

export function isAdminAuthenticated(): boolean {
  return Boolean(getAdminToken() && getCurrentAdmin());
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

function pendingAuthorizationHeader() {
  const token = sessionStorage.getItem(ADMIN_PENDING_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function safeHttpMessage(status: number, fallback: string, payload?: { message?: string }) {
  return status >= 500 ? 'Помилка сервера. Спробуйте пізніше.' : payload?.message || fallback;
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

export function canDeleteRecords(admin: AdminUser | null): boolean {
  return admin?.role === 'SYSTEM_OWNER';
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const response = await apiGet<AdminListResponse>('/api/admin/users');
  return response.admins;
}

export async function getMyAdminProfile(): Promise<AdminUser> {
  return (await apiGet<AdminResponse>('/api/admin/me')).admin;
}

export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_PENDING_TOKEN_KEY);
  const response = await fetch(getApiUrl('/api/admin/change-password'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(input),
  }).catch((error) => {
    if (import.meta.env.DEV) console.error('[adminService.changeOwnPassword]', error);
    throw new ApiUnavailableError();
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    throw new Error(safeHttpMessage(response.status, 'Не вдалося змінити пароль.', payload));
  }
  logoutAdmin();
}

export async function setupTwoFactor(): Promise<{ qrCodeDataUrl: string; manualEntryKey: string; issuer: string; accountName: string }> {
  const response = await fetch(getApiUrl('/api/admin/2fa/setup'), {
    method: 'POST',
    headers: { Accept: 'application/json', ...(pendingAuthorizationHeader() ?? {}) },
  }).catch((error) => {
    if (import.meta.env.DEV) console.error('[adminService.setupTwoFactor]', error);
    throw new ApiUnavailableError();
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(safeHttpMessage(response.status, 'Не вдалося почати налаштування 2FA.', payload));
  return payload;
}

async function submitTwoFactor(path: string, code: string): Promise<AdminUser> {
  const response = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(pendingAuthorizationHeader() ?? {}) },
    body: JSON.stringify({ code }),
  }).catch((error) => {
    if (import.meta.env.DEV) console.error('[adminService.submitTwoFactor]', error);
    throw new ApiUnavailableError();
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(safeHttpMessage(response.status, 'Невірний код автентифікатора', payload));
  if (!payload.token || !payload.admin) throw new Error('Некоректна відповідь сервера 2FA.');
  finishAdminLogin(payload.token, payload.admin);
  return payload.admin;
}

export function enableTwoFactor(code: string): Promise<AdminUser> {
  return submitTwoFactor('/api/admin/2fa/enable', code);
}

export function verifyTwoFactor(code: string): Promise<AdminUser> {
  return submitTwoFactor('/api/admin/2fa/verify', code);
}

export async function createAdminUser(input: {
  username: string;
  fullName: string;
  role: AdminRole;
  departmentId?: string | null;
  department?: string | null;
  departmentName?: string | null;
  unit?: string | null;
  password: string;
  isActive: boolean;
}): Promise<AdminUser> {
  return (await apiPost<AdminResponse>('/api/admin/users', input)).admin;
}

export async function updateAdminUser(id: string, input: Partial<{
  username: string;
  fullName: string;
  role: AdminRole;
  departmentId?: string | null;
  department?: string | null;
  departmentName?: string | null;
  unit?: string | null;
  password: string;
  isActive: boolean;
}>): Promise<AdminUser> {
  return (await apiPatch<AdminResponse>(`/api/admin/users/${encodeURIComponent(id)}`, input)).admin;
}

export async function resetAdminPassword(id: string, newTemporaryPassword: string): Promise<AdminUser> {
  return (await apiPatch<AdminResponse>(`/api/admin/users/${encodeURIComponent(id)}/password`, { newTemporaryPassword })).admin;
}

export async function resetAdminTwoFactor(id: string): Promise<AdminUser> {
  return (await apiPost<AdminResponse>(`/api/admin/users/${encodeURIComponent(id)}/2fa/reset`)).admin;
}

export async function deactivateAdminUser(id: string, input: { reason: string; confirmText: string }): Promise<void> {
  await apiDelete(`/api/admin/users/${encodeURIComponent(id)}`, input);
}
