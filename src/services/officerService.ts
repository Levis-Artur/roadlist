import { patrolOfficers } from '../mocks/patrolOfficers';
import type { CreateOfficerInput, Officer, OfficerFilters, UpdateOfficerInput } from '../types';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, isApiUnavailableError } from './apiClient';
import { addAuditLog } from './auditService';
import { BADGE_NUMBER_ERROR, isValidBadgeNumber } from '../utils/badgeNumber';
import { extractEntity, extractList } from '../utils/apiResponse';
import { generateId } from '../utils/generateId';

interface VerifyOfficerResponse {
  success: boolean;
  officer?: Officer;
}

interface OfficersResponse { success: boolean; officers: Officer[] }
interface OfficerResponse { success: boolean; officer: Officer }
interface OfficerLoginResponse { success: boolean; token: string; officer: Officer }
const OFFICER_STORAGE_KEY = 'patrol-officer-directory';
const OFFICER_PIN_STORAGE_KEY = 'patrol-officer-pin-hashes';
const OFFICER_TOKEN_KEY = 'officer_token';
const OFFICER_SESSION_KEY = 'officer_session';
const PIN_PATTERN = /^\d{4,8}$/;
export const PIN_ERROR = 'PIN має містити від 4 до 8 цифр.';

function initialOfficers(): Officer[] {
  const now = new Date().toISOString();
  return patrolOfficers.map((officer, index) => ({ ...officer, id: `local-officer-${index + 1}`, isActive: true, hasPin: true, createdAt: now, updatedAt: now }));
}

async function hashPin(pin: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function localPinHashes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(OFFICER_PIN_STORAGE_KEY) || '{}') as Record<string, string>; }
  catch { return {}; }
}

async function pinHashesWithDefaults(): Promise<Record<string, string>> {
  const hashes = localPinHashes();
  const defaults: Record<string, string> = { '0000001': '1111', '0000002': '2222', '0000003': '3333' };
  for (const [badgeNumber, pin] of Object.entries(defaults)) hashes[badgeNumber] ??= await hashPin(pin);
  localStorage.setItem(OFFICER_PIN_STORAGE_KEY, JSON.stringify(hashes));
  return hashes;
}

function localOfficers(): Officer[] {
  try {
    const stored = localStorage.getItem(OFFICER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) throw new Error('Invalid local officer directory');
      const officers = parsed as Officer[];
      const legacyTestBadges: Record<string, string> = { '000001': '0000001', '000002': '0000002', '000003': '0000003' };
      let migrated = false;
      const normalized = officers.map((officer) => {
        const badgeNumber = legacyTestBadges[officer.badgeNumber];
        if (!officer.id?.startsWith('local-officer-')) return officer;
        if (!badgeNumber) {
          if (officer.hasPin) return officer;
          migrated = true;
          return { ...officer, hasPin: true };
        }
        migrated = true;
        return { ...officer, badgeNumber, hasPin: true, updatedAt: new Date().toISOString() };
      });
      if (migrated) localStorage.setItem(OFFICER_STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch { /* Initialize a clean fallback directory below. */ }
  const officers = initialOfficers();
  localStorage.setItem(OFFICER_STORAGE_KEY, JSON.stringify(officers));
  return officers;
}

function saveLocalOfficers(officers: Officer[]) { localStorage.setItem(OFFICER_STORAGE_KEY, JSON.stringify(officers)); }

function queryString(filters: OfficerFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
  return params.size ? `?${params}` : '';
}

function filteredLocalOfficers(filters: OfficerFilters) {
  const search = filters.search?.trim().toLocaleLowerCase('uk-UA');
  return localOfficers().filter((officer) => (!search || `${officer.fullName} ${officer.badgeNumber}`.toLocaleLowerCase('uk-UA').includes(search))
    && (!filters.department || officer.department.toLocaleLowerCase('uk-UA').includes(filters.department.toLocaleLowerCase('uk-UA')))
    && (!filters.unit || (officer.unit ?? '').toLocaleLowerCase('uk-UA').includes(filters.unit.toLocaleLowerCase('uk-UA')))
    && (filters.isActive === undefined || Boolean(officer.isActive) === filters.isActive));
}

async function verifyOfficerLocally(badgeNumber: string): Promise<Officer | null> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const officer = localOfficers().find((item) => item.badgeNumber === badgeNumber && item.isActive !== false);
  return officer ?? null;
}

export async function getOfficers(filters: OfficerFilters = {}): Promise<Officer[]> {
  try { return extractList<Officer>(await apiGet<unknown>(`/api/officers${queryString(filters)}`), 'officers'); }
  catch (error) { if (!isApiUnavailableError(error)) throw error; return filteredLocalOfficers(filters); }
}

export async function createOfficer(input: CreateOfficerInput): Promise<Officer> {
  if (!isValidBadgeNumber(input.badgeNumber)) throw new Error(BADGE_NUMBER_ERROR);
  if (!PIN_PATTERN.test(input.pin)) throw new Error(PIN_ERROR);
  try {
    const officer = extractEntity<Officer>(await apiPost<unknown>('/api/officers', input), 'officer');
    if (!officer) throw new Error('Не вдалося зберегти патрульного. Некоректна відповідь сервера.');
    return officer;
  }
  catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const officers = localOfficers();
    if (officers.some((item) => item.badgeNumber === input.badgeNumber.trim())) throw new Error('Патрульний з таким номером жетона вже існує');
    const now = new Date().toISOString();
    const { pin, ...safeInput } = input;
    const officer: Officer = { ...safeInput, hasPin: true, badgeNumber: input.badgeNumber.trim(), fullName: input.fullName.trim(), department: input.department.trim(), unit: input.unit?.trim() || null, id: generateId('officer'), createdAt: now, updatedAt: now };
    saveLocalOfficers([...officers, officer]);
    const hashes = await pinHashesWithDefaults(); hashes[officer.badgeNumber] = await hashPin(pin); localStorage.setItem(OFFICER_PIN_STORAGE_KEY, JSON.stringify(hashes));
    await addAuditLog({ action: 'Створено патрульного', entityType: 'officer', entityId: officer.id, badgeNumber: officer.badgeNumber, details: `${officer.fullName}; ${officer.department}` }).catch(() => undefined);
    await addAuditLog({ action: 'Адміністратор встановив PIN', entityType: 'officer', entityId: officer.id, badgeNumber: officer.badgeNumber, details: officer.fullName }).catch(() => undefined);
    return officer;
  }
}

export async function updateOfficer(id: string, input: UpdateOfficerInput): Promise<Officer> {
  if (input.badgeNumber !== undefined && !isValidBadgeNumber(input.badgeNumber)) throw new Error(BADGE_NUMBER_ERROR);
  if (input.pin !== undefined && input.pin !== '' && !PIN_PATTERN.test(input.pin)) throw new Error(PIN_ERROR);
  try {
    const officer = extractEntity<Officer>(await apiPatch<unknown>(`/api/officers/${id}`, input), 'officer');
    if (!officer) throw new Error('Не вдалося зберегти патрульного. Некоректна відповідь сервера.');
    return officer;
  }
  catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const officers = localOfficers();
    const index = officers.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Патрульного не знайдено.');
    const previousBadgeNumber = officers[index].badgeNumber;
    const { pin, ...safeInput } = input;
    const updated = { ...officers[index], ...safeInput, hasPin: pin ? true : officers[index].hasPin, updatedAt: new Date().toISOString() };
    if (officers.some((item, itemIndex) => itemIndex !== index && item.badgeNumber === updated.badgeNumber)) throw new Error('Патрульний з таким номером жетона вже існує');
    officers[index] = updated;
    saveLocalOfficers(officers);
    const hashes = await pinHashesWithDefaults();
    if (pin) hashes[updated.badgeNumber] = await hashPin(pin);
    else if (previousBadgeNumber !== updated.badgeNumber && hashes[previousBadgeNumber]) hashes[updated.badgeNumber] = hashes[previousBadgeNumber];
    if (previousBadgeNumber !== updated.badgeNumber) delete hashes[previousBadgeNumber];
    localStorage.setItem(OFFICER_PIN_STORAGE_KEY, JSON.stringify(hashes));
    await addAuditLog({ action: 'Оновлено патрульного', entityType: 'officer', entityId: id, badgeNumber: updated.badgeNumber, details: `${updated.fullName}; ${updated.department}` }).catch(() => undefined);
    if (pin) await addAuditLog({ action: 'Адміністратор змінив PIN', entityType: 'officer', entityId: id, badgeNumber: updated.badgeNumber, details: updated.fullName }).catch(() => undefined);
    return updated;
  }
}

export async function loginOfficer(badgeNumber: string, pin: string): Promise<{ token: string; officer: Officer }> {
  const normalizedBadge = badgeNumber.trim();
  if (!isValidBadgeNumber(normalizedBadge) || !PIN_PATTERN.test(pin)) {
    await addAuditLog({ action: 'Невдала спроба входу патрульного', entityType: 'officer', badgeNumber: normalizedBadge, details: 'Невалідний формат облікових даних' }).catch(() => undefined);
    if (!isValidBadgeNumber(normalizedBadge)) throw new Error(BADGE_NUMBER_ERROR);
    throw new Error(PIN_ERROR);
  }
  try {
    const response = await apiPost<OfficerLoginResponse>('/api/officers/login', { badgeNumber: normalizedBadge, pin });
    sessionStorage.setItem(OFFICER_TOKEN_KEY, response.token);
    sessionStorage.setItem(OFFICER_SESSION_KEY, JSON.stringify(response.officer));
    return { token: response.token, officer: response.officer };
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const officer = localOfficers().find((item) => item.badgeNumber === normalizedBadge);
    if (!officer) throw new Error('Невірний номер жетона або PIN');
    if (officer.isActive === false) throw new Error('Обліковий запис патрульного неактивний');
    const hashes = await pinHashesWithDefaults();
    if (!hashes[normalizedBadge] || hashes[normalizedBadge] !== await hashPin(pin)) {
      await addAuditLog({ action: 'Невдала спроба входу патрульного', entityType: 'officer', badgeNumber: normalizedBadge }).catch(() => undefined);
      throw new Error('Невірний номер жетона або PIN');
    }
    const token = `local-officer-token:${normalizedBadge}`;
    const safeOfficer: Officer = { badgeNumber: officer.badgeNumber, fullName: officer.fullName, department: officer.department, unit: officer.unit };
    sessionStorage.setItem(OFFICER_TOKEN_KEY, token);
    sessionStorage.setItem(OFFICER_SESSION_KEY, JSON.stringify(safeOfficer));
    await addAuditLog({ action: 'Вхід патрульного успішний', entityType: 'officer', badgeNumber: normalizedBadge, details: officer.fullName }).catch(() => undefined);
    return { token, officer: safeOfficer };
  }
}

export async function logoutOfficer(): Promise<void> {
  try { if (getOfficerToken()) await apiPost('/api/officers/logout'); }
  catch { await addAuditLog({ action: 'Вихід патрульного', entityType: 'officer', badgeNumber: getAuthenticatedOfficer()?.badgeNumber }).catch(() => undefined); }
  finally { sessionStorage.removeItem(OFFICER_TOKEN_KEY); sessionStorage.removeItem(OFFICER_SESSION_KEY); }
}

export function getOfficerToken(): string | null { return sessionStorage.getItem(OFFICER_TOKEN_KEY); }
export function isOfficerAuthenticated(): boolean { return Boolean(getOfficerToken()); }
export function getAuthenticatedOfficer(): Officer | null {
  if (!isOfficerAuthenticated()) return null;
  try { return JSON.parse(sessionStorage.getItem(OFFICER_SESSION_KEY) || 'null') as Officer | null; } catch { return null; }
}

export async function deactivateOfficer(id: string): Promise<void> {
  try { await apiDelete(`/api/officers/${id}`); }
  catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const officers = localOfficers().map((item) => item.id === id ? { ...item, isActive: false, updatedAt: new Date().toISOString() } : item);
    saveLocalOfficers(officers);
    const officer = officers.find((item) => item.id === id);
    await addAuditLog({ action: 'Деактивовано патрульного', entityType: 'officer', entityId: id, badgeNumber: officer?.badgeNumber, details: officer?.fullName }).catch(() => undefined);
  }
}

export async function verifyOfficerByBadge(badgeNumber: string): Promise<Officer | null> {
  const normalizedBadge = badgeNumber.trim();
  if (!isValidBadgeNumber(normalizedBadge)) throw new Error(BADGE_NUMBER_ERROR);
  try {
    const response = await apiPost<VerifyOfficerResponse>('/api/officers/verify', { badgeNumber: normalizedBadge });
    return response.success ? response.officer ?? null : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    if (!isApiUnavailableError(error)) throw error;
    // Fallback використовується тільки для frontend MVP. У production має бути тільки backend verification.
    const officer = await verifyOfficerLocally(normalizedBadge);
    await addAuditLog({
      action: officer ? 'Перевірка жетона успішна' : 'Жетон не знайдено',
      entityType: 'officer',
      badgeNumber: normalizedBadge,
      details: officer?.fullName,
    }).catch(() => undefined);
    return officer;
  }
}
