import type { MonthlyRouteSheet } from '../../types';
import { formatConsumption, formatDate, formatLiters } from '../../utils/format';
import { monthNames } from './adminLabels';
import { isCrossMonthShift } from './monthlyHelpers';

interface MonthlySheetPrintModalProps {
  printMonthly: MonthlyRouteSheet;
  onClose: () => void;
  onPrint: (monthlyRouteSheet: MonthlyRouteSheet) => void;
}

export function MonthlySheetPrintModal({ printMonthly, onClose, onPrint }: MonthlySheetPrintModalProps) {
  return (
    <div className="modal-backdrop print-modal-backdrop" onMouseDown={onClose}>
      <section className="modal print-modal" role="dialog" aria-modal="true" aria-label="Друк місячного маршрутного листа" onMouseDown={(event) => event.stopPropagation()}>
        <div className="section-heading no-print"><div><span className="eyebrow">Друк</span><h2>Місячний маршрутний лист</h2></div><button type="button" className="text-button" onClick={onClose}>Закрити</button></div>
        <div className="button-row no-print">
          <button type="button" onClick={() => onPrint(printMonthly)}>Друкувати</button>
        </div>
        <article className="print-page">
          <header className="print-header">
            <h1>ЕЛЕКТРОННИЙ МАРШРУТНИЙ ЛИСТ</h1>
            <p>службового автомобіля</p>
          </header>
          <section className="print-summary-grid">
            <div><strong>Марка</strong><span>{printMonthly.vehicleBrand}</span></div>
            <div><strong>Модель</strong><span>{printMonthly.vehicleModel}</span></div>
            <div><strong>Номерний знак</strong><span>{printMonthly.displayVehicleNumber || printMonthly.vehicleNumber}</span></div>
            <div><strong>УПП</strong><span>{printMonthly.department}</span></div>
            <div><strong>Підрозділ</strong><span>{printMonthly.unit || '—'}</span></div>
            <div><strong>Місяць</strong><span>{monthNames[printMonthly.month - 1] ?? printMonthly.month}</span></div>
            <div><strong>Рік</strong><span>{printMonthly.year}</span></div>
          </section>
          <table className="print-table">
            <thead><tr>
              <th>№</th><th>Дата</th><th>Патрульний</th><th>Жетон</th><th>Початок зміни</th><th>Завершення зміни</th>
              <th>Початковий км</th><th>Кінцевий км</th><th>Пробіг</th><th>Заправка, л</th><th>Перевірка</th><th>Примітка</th>
            </tr></thead>
            <tbody>{(printMonthly.shiftEntries ?? []).map((entry, index) => (
              <tr key={entry.id}>
                <td>{index + 1}</td><td>{formatDate(entry.startedAt, true)}</td><td>{entry.fullName}</td><td>{entry.badgeNumber}</td>
                <td>{formatDate(entry.startedAt)}</td><td>{formatDate(entry.endedAt)}</td><td>{entry.startOdometer}</td>
                <td>{entry.endOdometer ?? '—'}</td><td>{entry.distanceKm ?? '—'}</td><td>{entry.refueled ? entry.fuelLiters ?? '—' : '—'}</td>
                <td>{entry.status === 'verified' ? 'Перевірено' : entry.status === 'needs_review' ? 'Потребує перевірки' : '—'}</td>
                <td>{[isCrossMonthShift(entry) ? 'Перехідна зміна' : '', entry.adminReviewComment || ''].filter(Boolean).join('; ')}</td>
              </tr>
            ))}</tbody>
          </table>
          <section className="print-totals">
            <p>Початковий кілометраж за місяць: <strong>{printMonthly.openingOdometer ?? '—'}</strong></p>
            <p>Кінцевий кілометраж за місяць: <strong>{printMonthly.closingOdometer ?? '—'}</strong></p>
            <p>Загальний пробіг: <strong>{printMonthly.totalDistanceKm} км</strong></p>
            <p>Загальна кількість літрів заправки: <strong>{printMonthly.totalFuelLiters.toLocaleString('uk-UA')} л</strong></p>
            <p>Кількість змін: <strong>{printMonthly.shiftEntries?.length ?? printMonthly.shiftCount ?? 0}</strong></p>
          </section>
          <section className="print-totals">
            <p><strong>Облік пального</strong></p>
            <p>Початковий залишок: <strong>{formatLiters(printMonthly.fuelSummary?.initialFuelLiters)}</strong></p>
            <p>Заправлено за місяць: <strong>{formatLiters(printMonthly.fuelSummary?.totalRefueledLiters ?? printMonthly.totalFuelLiters)}</strong></p>
            <p>Пробіг за місяць: <strong>{printMonthly.fuelSummary?.totalDistanceKm ?? printMonthly.totalDistanceKm} км</strong></p>
            <p>Норма витрати: <strong>{formatConsumption(printMonthly.fuelSummary?.fuelConsumptionPer100Km)}</strong></p>
            <p>Обʼєм бака: <strong>{formatLiters(printMonthly.fuelSummary?.fuelTankCapacityLiters)}</strong></p>
            <p>Розрахункова витрата: <strong>{formatLiters(printMonthly.fuelSummary?.estimatedFuelUsedLiters)}</strong></p>
            <p>Розрахунковий залишок: <strong>{formatLiters(printMonthly.fuelSummary?.estimatedFuelBalanceLiters)}</strong></p>
          </section>
          {!!printMonthly.fuelSummary?.fuelWarnings.length && <section className="print-totals"><p><strong>Попередження щодо пального:</strong></p>{printMonthly.fuelSummary.fuelWarnings.map((warning) => <p key={warning}>{warning}</p>)}</section>}
          <section className="signature-block">
            <p>Кінцевий кілометраж звірено: ______________________</p>
            <p>Адміністратор: ______________________</p>
            <p>Підпис: ______________________</p>
            <p>Дата: ____ / ____ / ______</p>
          </section>
        </article>
      </section>
    </div>
  );
}
