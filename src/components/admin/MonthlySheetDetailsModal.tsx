import type { MonthlyRouteSheet } from '../../types';
import { formatConsumption, formatDate, formatLiters } from '../../utils/format';
import { DetailItem, StoredPhoto } from './AdminDetail';
import { monthNames, monthlyStatusLabels, routeSheetStatusLabels } from './adminLabels';
import { isCrossMonthShift } from './monthlyHelpers';

interface MonthlySheetDetailsModalProps {
  selectedMonthly: MonthlyRouteSheet;
  onClose: () => void;
  onOpenPrint: (id: string) => void;
  onCloseMonth: (id: string) => void;
  onReopenMonth: (id: string) => void;
}

export function MonthlySheetDetailsModal({
  selectedMonthly,
  onClose,
  onOpenPrint,
  onCloseMonth,
  onReopenMonth,
}: MonthlySheetDetailsModalProps) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal detail-modal monthly-detail-modal" role="dialog" aria-modal="true" aria-label="Деталі місячного маршрутного листа" onMouseDown={(event) => event.stopPropagation()}>
        <div className="section-heading"><div><span className="eyebrow">Маршрутний лист авто</span><h2>Деталі місячного листа</h2></div><button type="button" className="text-button" onClick={onClose}>Закрити</button></div>
        <dl className="detail-grid">
          <DetailItem label="Автомобіль" value={`${selectedMonthly.vehicleBrand} ${selectedMonthly.vehicleModel}`} />
          <DetailItem label="Номерний знак" value={selectedMonthly.displayVehicleNumber || selectedMonthly.vehicleNumber} />
          <DetailItem label="УПП" value={selectedMonthly.department} />
          <DetailItem label="Підрозділ" value={selectedMonthly.unit || '—'} />
          <DetailItem label="Місяць/рік" value={`${monthNames[selectedMonthly.month - 1] ?? selectedMonthly.month} ${selectedMonthly.year}`} />
          <DetailItem label="Початковий кілометраж" value={selectedMonthly.openingOdometer === null || selectedMonthly.openingOdometer === undefined ? '—' : `${selectedMonthly.openingOdometer} км`} />
          <DetailItem label="Кінцевий кілометраж" value={selectedMonthly.closingOdometer === null || selectedMonthly.closingOdometer === undefined ? '—' : `${selectedMonthly.closingOdometer} км`} />
          <DetailItem label="Сумарний пробіг" value={`${selectedMonthly.totalDistanceKm} км`} />
          <DetailItem label="Сумарна заправка" value={`${selectedMonthly.totalFuelLiters.toLocaleString('uk-UA')} л`} />
          <DetailItem label="Статус" value={<span className={`status ${selectedMonthly.status}`}>{monthlyStatusLabels[selectedMonthly.status] ?? selectedMonthly.status}</span>} />
        </dl>
        <section className="fuel-accounting-card">
          <div className="section-heading inline-heading"><div><span className="eyebrow">Автомобіль</span><h3>Облік пального</h3></div></div>
          <dl className="detail-grid">
            <DetailItem label="Початковий залишок" value={formatLiters(selectedMonthly.fuelSummary?.initialFuelLiters)} />
            <DetailItem label="Заправлено за місяць" value={formatLiters(selectedMonthly.fuelSummary?.totalRefueledLiters ?? selectedMonthly.totalFuelLiters)} />
            <DetailItem label="Пробіг за місяць" value={`${selectedMonthly.fuelSummary?.totalDistanceKm ?? selectedMonthly.totalDistanceKm} км`} />
            <DetailItem label="Норма витрати" value={formatConsumption(selectedMonthly.fuelSummary?.fuelConsumptionPer100Km)} />
            <DetailItem label="Обʼєм бака" value={formatLiters(selectedMonthly.fuelSummary?.fuelTankCapacityLiters)} />
            <DetailItem label="Розрахункова витрата" value={formatLiters(selectedMonthly.fuelSummary?.estimatedFuelUsedLiters)} />
            <DetailItem label="Розрахунковий залишок" value={formatLiters(selectedMonthly.fuelSummary?.estimatedFuelBalanceLiters)} />
          </dl>
          {!!selectedMonthly.fuelSummary?.fuelWarnings.length && <div className="message warning" role="status">{selectedMonthly.fuelSummary.fuelWarnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
        </section>
        <div className="button-row compact-row">
          <button type="button" className="small-button" onClick={() => onOpenPrint(selectedMonthly.id)}>Друк</button>
          {selectedMonthly.status === 'closed' ? (
            <button type="button" className="small-button" onClick={() => onReopenMonth(selectedMonthly.id)}>Повернути в роботу</button>
          ) : (
            <button type="button" className="small-button danger-mini" disabled={selectedMonthly.status !== 'open'} onClick={() => onCloseMonth(selectedMonthly.id)}>Закрити місяць</button>
          )}
        </div>
        <div className="table-scroll nested-table">
          <table className="responsive-table monthly-entries-table">
            <thead><tr>
              <th>Дата</th><th>Час початку</th><th>Час завершення</th><th>ПІБ патрульного</th><th>Жетон</th>
              <th>Екіпаж / підрозділ</th><th>Початковий км</th><th>Кінцевий км</th><th>Пробіг</th>
              <th>Заправка</th><th>Літри</th><th>Фото початку</th><th>Фото завершення</th><th>Примітка</th><th>Статус</th>
            </tr></thead>
            <tbody>{(selectedMonthly.shiftEntries ?? []).map((entry) => (
              <tr key={entry.id}>
                <td>{formatDate(entry.startedAt, true)}</td><td>{formatDate(entry.startedAt)}</td><td>{formatDate(entry.endedAt)}</td>
                <td>{entry.fullName}</td><td>{entry.badgeNumber}</td><td>{entry.crewNumber || '—'}</td>
                <td>{entry.startOdometer}</td><td>{entry.endOdometer ?? '—'}</td><td>{entry.distanceKm ?? '—'}</td>
                <td>{entry.refueled ? 'Так' : 'Ні'}</td><td>{entry.refueled ? entry.fuelLiters ?? '—' : '—'}</td>
                <td><div className="table-photo"><StoredPhoto photoId={entry.startPhotoId} alt="Фото початку зміни" /></div></td>
                <td><div className="table-photo"><StoredPhoto photoId={entry.endPhotoId} alt="Фото завершення зміни" /></div></td>
                <td>{isCrossMonthShift(entry) ? <span className="meta-badge warning">Перехідна зміна</span> : '—'}</td>
                <td><span className={`status ${entry.status}`}>{routeSheetStatusLabels[entry.status]}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
