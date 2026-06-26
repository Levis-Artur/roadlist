import type { AddAuditLogInput, AuditLog } from '../types';
import { apiGet, apiPost } from './apiClient';
import { extractList } from '../utils/apiResponse';

export async function addAuditLog(input: AddAuditLogInput): Promise<void> {
  await apiPost('/api/audit-logs', input);
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  return extractList<AuditLog>(await apiGet<unknown>('/api/audit-logs'), 'auditLogs');
}

export async function clearAuditLogs(): Promise<void> {
  localStorage.removeItem('patrol-route-sheet-audit-logs');
}
