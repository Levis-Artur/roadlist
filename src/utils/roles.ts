import type { AdminRole } from '../types';

export const adminRoleLabels: Record<AdminRole, string> = {
  SYSTEM_OWNER: 'Власник системи',
  NATIONAL_ADMIN: 'Національний адміністратор',
  REGIONAL_ADMIN: 'Регіональний адміністратор',
};
