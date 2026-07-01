import type { MonthlyRouteSheet } from '../../types';
import { monthNames, monthlyStatusLabels } from './adminLabels';

interface MonthlySheetsSectionProps {
  loading: boolean;
  monthlyRouteSheets: MonthlyRouteSheet[];
  filteredMonthlyRouteSheets: MonthlyRouteSheet[];
  canDelete: boolean;
  onOpenDetails: (id: string) => void;
  onOpenPrint: (id: string) => void;
  onCloseMonth: (id: string) => void;
  onReopenMonth: (id: string) => void;
  onRequestDelete: (target: { type: 'monthly'; id: string; label: string }) => void;
}

export function MonthlySheetsSection({
  loading,
  monthlyRouteSheets,
  filteredMonthlyRouteSheets,
  canDelete,
  onOpenDetails,
  onOpenPrint,
  onCloseMonth,
  onReopenMonth,
  onRequestDelete,
}: MonthlySheetsSectionProps) {
  if (loading) return <section className="empty-state"><h2>Завантажуємо місячні маршрутні листи...</h2></section>;
  if (!monthlyRouteSheets.length) return <section className="empty-state"><h2>Місячних маршрутних листів ще немає</h2><p>Перший лист створиться автоматично під час початку зміни на автомобілі.</p></section>;
  if (!filteredMonthlyRouteSheets.length) return <section className="empty-state"><h2>Записів не знайдено</h2><p>Змініть фільтр управління або підрозділу.</p></section>;

  return (
    <section className="table-card">
      <div className="table-scroll">
        <table className="responsive-table monthly-sheets-table">
          <thead><tr>
            <th>Автомобіль</th><th>Номерний знак</th><th>УПП</th><th>Підрозділ</th><th>Місяць</th><th>Рік</th>
            <th>Статус</th><th>Початковий км</th><th>Кінцевий км</th><th>Загальний пробіг</th>
            <th>Загальна заправка, л</th><th>Кількість змін</th><th>Дії</th>
          </tr></thead>
          <tbody>{filteredMonthlyRouteSheets.map((item) => (
            <tr key={item.id}>
              <td>{item.vehicleBrand} {item.vehicleModel}</td>
              <td>{item.displayVehicleNumber || item.vehicleNumber}</td>
              <td>{item.department}</td>
              <td>{item.unit || '—'}</td>
              <td>{monthNames[item.month - 1] ?? item.month}</td>
              <td>{item.year}</td>
              <td><span className={`status ${item.status}`}>{monthlyStatusLabels[item.status] ?? item.status}</span></td>
              <td>{item.openingOdometer ?? '—'}</td>
              <td>{item.closingOdometer ?? '—'}</td>
              <td>{item.totalDistanceKm}</td>
              <td>{item.totalFuelLiters.toLocaleString('uk-UA')}</td>
              <td>{item.shiftCount ?? item.shiftEntries?.length ?? 0}</td>
              <td className="action-cell">
                <div className="button-row compact-row">
                  <button type="button" className="small-button" onClick={() => onOpenDetails(item.id)}>Переглянути</button>
                  <button type="button" className="small-button" onClick={() => onOpenPrint(item.id)}>Друк</button>
                  {item.status === 'closed' ? (
                    <button type="button" className="small-button" onClick={() => onReopenMonth(item.id)}>Повернути в роботу</button>
                  ) : (
                    <button type="button" className="small-button danger-mini" disabled={item.status !== 'open'} onClick={() => onCloseMonth(item.id)}>Закрити місяць</button>
                  )}
                  {canDelete && <button type="button" className="small-button danger-outline" onClick={() => onRequestDelete({ type: 'monthly', id: item.id, label: `${item.vehicleBrand} ${item.vehicleModel} ${item.displayVehicleNumber || item.vehicleNumber}` })}>Видалити</button>}
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
