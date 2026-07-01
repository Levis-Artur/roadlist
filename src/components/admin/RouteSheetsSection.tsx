import type { RouteSheet } from '../../types';
import { formatDate } from '../../utils/format';
import { routeSheetStatusLabels } from './adminLabels';

interface RouteSheetsSectionProps {
  loading: boolean;
  routeSheets: RouteSheet[];
  filteredRouteSheets: RouteSheet[];
  canDelete: boolean;
  displayVehicle: (vehicleNumber: string) => string;
  onOpenDetails: (id: string) => void;
  onRequestDelete: (target: { type: 'route'; id: string; label: string }) => void;
}

export function RouteSheetsSection({
  loading,
  routeSheets,
  filteredRouteSheets,
  canDelete,
  displayVehicle,
  onOpenDetails,
  onRequestDelete,
}: RouteSheetsSectionProps) {
  if (loading) return <section className="empty-state"><h2>Завантажуємо маршрутні листи...</h2></section>;
  if (!routeSheets.length) return <section className="empty-state"><h2>Маршрутних листів ще немає</h2><p>Створені зміни з’являться тут автоматично.</p></section>;
  if (!filteredRouteSheets.length) return <section className="empty-state"><h2>Записів не знайдено</h2><p>Змініть пошуковий запит або фільтр статусу.</p></section>;

  return (
    <section className="table-card">
      <div className="table-scroll">
        <table className="responsive-table route-sheets-table">
          <thead><tr>
            <th>Дата</th><th>ПІБ</th><th>Номер жетона</th><th>УПП</th><th>Підрозділ</th>
            <th>Екіпаж / підрозділ</th><th>Автомобіль</th><th>Початковий км</th><th>Кінцевий км</th>
            <th>Пробіг</th><th>Заправка</th><th>Літри</th><th>Статус</th><th>Ручне внесення</th><th>Потребує перевірки</th>
            <th>Час початку</th><th>Час завершення</th><th>Деталі</th>
          </tr></thead>
          <tbody>{filteredRouteSheets.map((item) => (
            <tr key={item.id}>
              <td>{formatDate(item.createdAt, true)}</td><td>{item.fullName}</td><td>{item.badgeNumber}</td>
              <td>{item.department}</td><td>{item.unit || '—'}</td><td>{item.crewNumber || '—'}</td><td>{displayVehicle(item.vehicleNumber)}</td><td>{item.startOdometer}</td>
              <td>{item.endOdometer ?? '—'}</td><td>{item.distanceKm ?? '—'}</td><td>{item.refueled ? 'Так' : 'Ні'}</td><td>{item.refueled ? item.fuelLiters ?? '—' : '—'}</td>
              <td><span className={`status ${item.status}`}>{routeSheetStatusLabels[item.status]}</span></td>
              <td><span className={`meta-badge ${item.startManualEntry || item.endManualEntry ? 'manual' : ''}`}>{item.startManualEntry || item.endManualEntry ? 'Так' : 'Ні'}</span></td><td>{item.status === 'needs_review' ? 'Так' : 'Ні'}</td>
              <td>{formatDate(item.startedAt)}</td><td>{formatDate(item.endedAt)}</td>
              <td className="row-actions">
                <button type="button" className="small-button" onClick={() => onOpenDetails(item.id)}>{item.status === 'needs_review' ? 'Перевірити' : 'Деталі'}</button>
                {canDelete && <button type="button" className="small-button danger-outline" onClick={() => onRequestDelete({ type: 'route', id: item.id, label: item.fullName })}>Видалити</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
