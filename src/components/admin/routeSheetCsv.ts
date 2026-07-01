import type { RouteSheet } from '../../types';
import { downloadCsvFile } from '../../utils/csv';
import { formatDate } from '../../utils/format';
import { routeSheetStatusLabels } from './adminLabels';

export function exportRouteSheetsCsv(routeSheets: RouteSheet[]) {
  const headers = [
    'Дата', 'ПІБ', 'Номер жетона', 'УПП', 'Підрозділ', 'Номер екіпажу / підрозділу',
    'Номер автомобіля', 'Початковий кілометраж', 'Кінцевий кілометраж', 'Пробіг',
    'Статус', 'Ручне внесення початку', 'Ручне внесення кінця', 'Час початку', 'Час завершення',
    'Дата перевірки адміністратором', 'Перевірив', 'Коментар адміністратора',
  ];
  const rows = routeSheets.map((item) => [
    formatDate(item.createdAt, true), item.fullName, item.badgeNumber, item.department,
    item.unit || '—', item.crewNumber || '—', item.vehicleNumber, item.startOdometer, item.endOdometer, item.distanceKm,
    routeSheetStatusLabels[item.status], item.startManualEntry ? 'Так' : 'Ні',
    item.endManualEntry === undefined ? '' : item.endManualEntry ? 'Так' : 'Ні',
    formatDate(item.startedAt), item.endedAt ? formatDate(item.endedAt) : '',
    item.adminVerifiedAt ? formatDate(item.adminVerifiedAt) : '—',
    item.adminVerifiedBy || '—',
    item.adminReviewComment || '—',
  ]);
  downloadCsvFile('route-sheets-export.csv', [headers, ...rows]);
}
