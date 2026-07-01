import type { RouteSheet } from '../../types';

export function isCrossMonthShift(entry: RouteSheet): boolean {
  if (!entry.endedAt) return false;
  const startedAt = new Date(entry.startedAt);
  const endedAt = new Date(entry.endedAt);
  return startedAt.getFullYear() !== endedAt.getFullYear() || startedAt.getMonth() !== endedAt.getMonth();
}
