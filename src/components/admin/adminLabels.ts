import type { MonthlyRouteSheetStatus, RouteSheetStatus } from '../../types';

export const routeSheetStatusLabels: Record<RouteSheetStatus, string> = {
  active: 'Активна',
  completed: 'Завершена',
  needs_review: 'Потребує перевірки',
  verified: 'Перевірено',
};

export const monthlyStatusLabels: Record<MonthlyRouteSheetStatus | string, string> = {
  open: 'В роботі',
  closed: 'Закритий',
  archived: 'В архіві',
};

export const monthNames = [
  'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
  'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень',
];
