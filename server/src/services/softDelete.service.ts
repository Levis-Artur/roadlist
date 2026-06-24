import { AppError } from '../middleware/errorHandler.js';
import type { AdminTokenPayload, RequestMetadata } from '../types/index.js';

export const OWNER_DELETE_MESSAGE = 'Видалення доступне тільки власнику системи';
export const DELETE_CONFIRM_TEXT = 'ВИДАЛИТИ';

export function canIncludeDeleted(actor?: AdminTokenPayload, value?: unknown) {
  return actor?.role === 'SYSTEM_OWNER' && value === 'true';
}

export function assertSystemOwner(actor?: AdminTokenPayload) {
  if (actor?.role !== 'SYSTEM_OWNER') throw new AppError(OWNER_DELETE_MESSAGE, 403);
}

export function deletionPayload(input: Record<string, unknown>, actor?: AdminTokenPayload) {
  assertSystemOwner(actor);
  if (input.confirmText !== DELETE_CONFIRM_TEXT) {
    throw new AppError('Підтвердіть видалення текстом “ВИДАЛИТИ”.', 400);
  }
  const reason = typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim() : '';
  if (!reason) throw new AppError('Вкажіть причину видалення.', 400);
  return {
    isDeleted: true,
    deletedAt: new Date(),
    deletedByAdminId: actor?.adminId ?? null,
    deletedByUsername: actor?.username ?? null,
    deleteReason: reason,
  };
}

export function deletionAuditMetadata(actor: AdminTokenPayload | undefined, metadata: RequestMetadata): RequestMetadata {
  return {
    ...metadata,
    actorAdminId: actor?.adminId ?? metadata.actorAdminId,
    actorUsername: actor?.username ?? metadata.actorUsername,
    actorRole: actor?.role ?? metadata.actorRole,
    actorDepartment: actor?.department ?? metadata.actorDepartment ?? null,
    actorUnit: actor?.unit ?? metadata.actorUnit ?? null,
    actorDepartmentId: actor?.departmentId ?? metadata.actorDepartmentId ?? null,
  };
}
