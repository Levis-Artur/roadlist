import type { AddAuditLogInput, AuditLog } from '../types';
import { apiGet, apiPost, isApiUnavailableError } from './apiClient';

const AUDIT_STORAGE_KEY = 'patrol-route-sheet-audit-logs';

interface AuditLogsResponse {
  success: boolean;
  auditLogs: AuditLog[];
}

function localAuditLogs(): AuditLog[] {
  try {
    const value = localStorage.getItem(AUDIT_STORAGE_KEY);
    return value ? (JSON.parse(value) as AuditLog[]) : [];
  } catch {
    return [];
  }
}

export async function addAuditLog(input: AddAuditLogInput): Promise<void> {
  try {
    await apiPost('/api/audit-logs', input);
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const log: AuditLog = { id: crypto.randomUUID(), ...input, createdAt: new Date().toISOString() };
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify([log, ...localAuditLogs()].slice(0, 1000)));
  }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  try {
    return (await apiGet<AuditLogsResponse>('/api/audit-logs')).auditLogs;
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    return localAuditLogs();
  }
}

export async function clearAuditLogs(): Promise<void> {
  localStorage.removeItem(AUDIT_STORAGE_KEY);
}
