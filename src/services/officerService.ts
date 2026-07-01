import type { CreateOfficerInput, Officer, OfficerFilters, UpdateOfficerInput } from '../types';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from './apiClient';
import { BADGE_NUMBER_ERROR, isValidBadgeNumber } from '../utils/badgeNumber';
import { extractEntity, extractList } from '../utils/apiResponse';

interface VerifyOfficerResponse {
  success: boolean;
  officer?: Officer;
}

interface OfficerLoginResponse {
  success: boolean;
  token: string;
  officer: Officer;
}

const OFFICER_TOKEN_KEY = 'officer_token';
const OFFICER_SESSION_KEY = 'officer_session';
const PIN_PATTERN = /^\d{4,8}$/;
export const PIN_ERROR = 'PIN має містити від 4 до 8 цифр.';

function queryString(filters: OfficerFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.size ? `?${params}` : '';
}

export async function getOfficers(filters: OfficerFilters = {}): Promise<Officer[]> {
  return extractList<Officer>(await apiGet<unknown>(`/api/officers${queryString(filters)}`, { auth: 'admin' }), 'officers');
}

export async function createOfficer(input: CreateOfficerInput): Promise<Officer> {
  if (!isValidBadgeNumber(input.badgeNumber)) throw new Error(BADGE_NUMBER_ERROR);
  if (!PIN_PATTERN.test(input.pin)) throw new Error(PIN_ERROR);
  const officer = extractEntity<Officer>(await apiPost<unknown>('/api/officers', input, { auth: 'admin' }), 'officer');
  if (!officer) throw new Error('Не вдалося зберегти патрульного. Некоректна відповідь сервера.');
  return officer;
}

export async function updateOfficer(id: string, input: UpdateOfficerInput): Promise<Officer> {
  if (input.badgeNumber !== undefined && !isValidBadgeNumber(input.badgeNumber)) throw new Error(BADGE_NUMBER_ERROR);
  if (input.pin !== undefined && input.pin !== '' && !PIN_PATTERN.test(input.pin)) throw new Error(PIN_ERROR);
  const officer = extractEntity<Officer>(await apiPatch<unknown>(`/api/officers/${id}`, input, { auth: 'admin' }), 'officer');
  if (!officer) throw new Error('Не вдалося зберегти патрульного. Некоректна відповідь сервера.');
  return officer;
}

export async function loginOfficer(badgeNumber: string, pin: string): Promise<{ token: string; officer: Officer }> {
  const normalizedBadge = badgeNumber.trim();
  if (!isValidBadgeNumber(normalizedBadge)) throw new Error(BADGE_NUMBER_ERROR);
  if (!PIN_PATTERN.test(pin)) throw new Error(PIN_ERROR);
  const response = await apiPost<OfficerLoginResponse>('/api/officers/login', { badgeNumber: normalizedBadge, pin }, { auth: 'none' });
  sessionStorage.setItem(OFFICER_TOKEN_KEY, response.token);
  sessionStorage.setItem(OFFICER_SESSION_KEY, JSON.stringify(response.officer));
  return { token: response.token, officer: response.officer };
}

export async function logoutOfficer(): Promise<void> {
  try {
    if (getOfficerToken()) await apiPost('/api/officers/logout', undefined, { auth: 'officer' });
  } finally {
    sessionStorage.removeItem(OFFICER_TOKEN_KEY);
    sessionStorage.removeItem(OFFICER_SESSION_KEY);
  }
}

export function getOfficerToken(): string | null {
  return sessionStorage.getItem(OFFICER_TOKEN_KEY);
}

export function isOfficerAuthenticated(): boolean {
  return Boolean(getOfficerToken());
}

export function getAuthenticatedOfficer(): Officer | null {
  if (!isOfficerAuthenticated()) return null;
  try {
    return JSON.parse(sessionStorage.getItem(OFFICER_SESSION_KEY) || 'null') as Officer | null;
  } catch {
    return null;
  }
}

export async function deactivateOfficer(id: string, input: { reason?: string; confirmText?: string } = {}): Promise<void> {
  await apiDelete(`/api/officers/${id}`, input.reason ? input : undefined, { auth: 'admin' });
}

export async function verifyOfficerByBadge(badgeNumber: string): Promise<Officer | null> {
  const normalizedBadge = badgeNumber.trim();
  if (!isValidBadgeNumber(normalizedBadge)) throw new Error(BADGE_NUMBER_ERROR);
  try {
    const response = await apiPost<VerifyOfficerResponse>('/api/officers/verify', { badgeNumber: normalizedBadge }, { auth: 'none' });
    return response.success ? response.officer ?? null : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
