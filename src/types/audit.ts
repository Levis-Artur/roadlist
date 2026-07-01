export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  badgeNumber?: string;
  details?: string;
  actorUnit?: string | null;
  targetUnit?: string | null;
  actorDepartmentId?: string | null;
  targetDepartmentId?: string | null;
  createdAt: string;
}

export type AddAuditLogInput = Omit<AuditLog, 'id' | 'createdAt'>;
