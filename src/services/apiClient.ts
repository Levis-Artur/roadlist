export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiUnavailableError extends Error {
  constructor() {
    super('Сервер недоступний. Спробуйте пізніше.');
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

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const adminOnlyPath = path.startsWith('/api/admin')
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
      || (path.startsWith('/api/vehicles') && !path.startsWith('/api/vehicles/available'));
    const token = adminOnlyPath
      ? sessionStorage.getItem('admin_token')
      : sessionStorage.getItem('officer_token') || sessionStorage.getItem('admin_token');
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
      throw new ApiError(payload?.message || `Помилка API (${response.status}).`, response.status);
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

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function apiDelete(path: string): Promise<void> {
  return request<void>(path, { method: 'DELETE' });
}

export function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(path, { method: 'POST', body: formData });
}
