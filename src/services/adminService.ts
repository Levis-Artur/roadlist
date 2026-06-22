import { ApiError, apiPost, isApiUnavailableError } from './apiClient';
import { addAuditLog } from './auditService';

const ADMIN_TOKEN_KEY = 'admin_token';
const LEGACY_AUTH_KEY = 'admin_authenticated';

interface AdminLoginResponse {
  success: boolean;
  token?: string;
}

export async function loginAdmin(password: string): Promise<boolean> {
  try {
    const response = await apiPost<AdminLoginResponse>('/api/admin/login', { password });
    if (!response.success || !response.token) return false;
    sessionStorage.setItem(ADMIN_TOKEN_KEY, response.token);
    sessionStorage.removeItem(LEGACY_AUTH_KEY);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return false;
    if (!isApiUnavailableError(error)) throw error;
    // Frontend-only fallback for the MVP; production authentication must use the backend.
    const authenticated = password === 'admin123';
    if (authenticated) sessionStorage.setItem(ADMIN_TOKEN_KEY, 'local-mock-admin-token');
    await addAuditLog({ action: authenticated ? 'Адмін увійшов локально' : 'Невдала локальна спроба входу', entityType: 'admin' }).catch(() => undefined);
    return authenticated;
  }
}

export function logoutAdmin(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_AUTH_KEY);
}

export function isAdminAuthenticated(): boolean {
  return Boolean(getAdminToken());
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}
