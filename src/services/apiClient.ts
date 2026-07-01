export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiUnavailableError extends Error {
  constructor() {
    super('Сервер недоступний. Перевірте підключення або спробуйте пізніше.');
    this.name = 'ApiUnavailableError';
  }
}

export function isApiUnavailableError(error: unknown): error is ApiUnavailableError {
  return error instanceof ApiUnavailableError;
}

export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (API_URL.endsWith('/api') && (normalizedPath === '/api' || normalizedPath.startsWith('/api/'))) {
    return `${API_URL}${normalizedPath.slice(4)}`;
  }
  return `${API_URL}${normalizedPath}`;
}

type AuthMode = 'auto' | 'admin' | 'officer' | 'none';

interface ApiRequestOptions {
  auth?: AuthMode;
}

function inferAuthMode(path: string): Exclude<AuthMode, 'auto'> {
  const adminOnlyPath = path.startsWith('/api/admin')
    || path.startsWith('/api/admin-users')
    || (path.startsWith('/api/officers')
      && !path.startsWith('/api/officers/login')
      && !path.startsWith('/api/officers/logout')
      && !path.startsWith('/api/officers/verify'))
    || (path.startsWith('/api/route-sheets')
      && !path.startsWith('/api/route-sheets/start')
      && !path.startsWith('/api/route-sheets/finish')
      && !path.startsWith('/api/route-sheets/active/me'))
    || path.startsWith('/api/monthly-route-sheets')
    || path.startsWith('/api/audit')
    || path.startsWith('/api/departments')
    || path.startsWith('/api/department-units')
    || (path.startsWith('/api/vehicles') && !path.startsWith('/api/vehicles/available'));
  return adminOnlyPath ? 'admin' : 'officer';
}

function getAuthToken(auth: AuthMode, path: string): string | null {
  const resolvedAuth = auth === 'auto' ? inferAuthMode(path) : auth;
  if (resolvedAuth === 'none') return null;
  if (resolvedAuth === 'admin') return sessionStorage.getItem('admin_token');
  return sessionStorage.getItem('officer_token') || sessionStorage.getItem('admin_token');
}

async function request<T>(path: string, init: RequestInit, options: ApiRequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const auth = options.auth ?? 'auto';
    const token = getAuthToken(auth, path);
    const response = await fetch(getApiUrl(path), {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json')
      ? await response.json() as { message?: string }
      : undefined;
    if (!response.ok) {
      if (response.status === 401 && (auth === 'admin' || (auth === 'auto' && inferAuthMode(path) === 'admin'))) {
        sessionStorage.removeItem('admin_token');
        sessionStorage.removeItem('admin_user');
        window.dispatchEvent(new CustomEvent('admin-session-expired'));
      }
      const safeMessage = response.status >= 500
        ? 'Помилка сервера. Спробуйте пізніше.'
        : payload?.message || `Помилка API (${response.status}).`;
      throw new ApiError(safeMessage, response.status);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (import.meta.env.DEV) console.error('[apiClient]', error);
    throw new ApiUnavailableError();
  } finally {
    window.clearTimeout(timeout);
  }
}

export function apiGet<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  return request<T>(path, { method: 'GET' }, options);
}

export function apiPost<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, options);
}

export function apiPatch<T>(path: string, body: unknown, options?: ApiRequestOptions): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, options);
}

export function apiDelete(path: string, body?: unknown, options?: ApiRequestOptions): Promise<void> {
  return request<void>(path, {
    method: 'DELETE',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, options);
}

export function apiUpload<T>(path: string, formData: FormData, options?: ApiRequestOptions): Promise<T> {
  return request<T>(path, { method: 'POST', body: formData }, options);
}
