import { env } from '../config/env.js';
import type { RequestMetadata } from '../types/index.js';
import { createAuditLog } from './audit.service.js';

// Frontend-compatible MVP password check. This is not production authentication or security.
export async function loginAdmin(password: string, metadata: RequestMetadata = {}) {
  const success = password === env.adminPassword;
  await createAuditLog({ action: success ? 'Адмін увійшов' : 'Невдала спроба входу адміністратора', entityType: 'admin', ...metadata });
  return success;
}
