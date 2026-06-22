import { useEffect, useMemo, useState } from 'react';
import { OfficerDirectory } from '../components/OfficerDirectory';
import { VehicleDirectory } from '../components/VehicleDirectory';
import { addAuditLog, clearAuditLogs, getAuditLogs } from '../services/auditService';
import { clearOdometerPhotos, getOdometerPhoto } from '../services/photoService';
import { clearRouteSheets, getRouteSheetById, getRouteSheets } from '../services/routeSheetService';
import { getPilotStatus, getPilotVehicles } from '../services/pilotService';
import type { AuditLog, PilotStatus, RouteSheet, RouteSheetStatus, Vehicle } from '../types';
import { findVehicleByNumber, formatVehicleLabel } from '../utils/vehicleDisplay';

const statusLabels: Record<RouteSheetStatus, string> = {
  active: 'Активна',
  completed: 'Завершено',
  needs_review: 'Потребує перевірки',
};

function displayVehicleFromList(vehicles: Vehicle[], vehicleNumber: string): string {
  const vehicle = findVehicleByNumber(vehicles, vehicleNumber);
  return vehicle ? formatVehicleLabel(vehicle) : vehicleNumber;
}

function formatDate(value?: string, dateOnly = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('uk-UA', dateOnly
    ? { dateStyle: 'short' }
    : { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function csvCell(value: string | number | boolean | undefined): string {
  const text = value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(routeSheets: RouteSheet[]) {
  const headers = [
    'Дата', 'ПІБ', 'Номер жетона', 'УПП', 'Номер екіпажу / підрозділу',
    'Номер автомобіля', 'Початковий кілометраж', 'Кінцевий кілометраж', 'Пробіг',
    'Статус', 'Ручне внесення початку', 'Ручне внесення кінця', 'Час початку', 'Час завершення',
  ];
  const rows = routeSheets.map((item) => [
    formatDate(item.createdAt, true), item.fullName, item.badgeNumber, item.department,
    item.crewNumber || '—', item.vehicleNumber, item.startOdometer, item.endOdometer, item.distanceKm,
    statusLabels[item.status], item.startManualEntry ? 'Так' : 'Ні',
    item.endManualEntry === undefined ? '' : item.endManualEntry ? 'Так' : 'Ні',
    formatDate(item.startedAt), item.endedAt ? formatDate(item.endedAt) : '',
  ]);
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'route-sheets-export.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportPilotCsv(routeSheets: RouteSheet[], vehicles: Vehicle[]) {
  const headers = [
    'Дата', 'ПІБ', 'Номер жетона', 'УПП', 'Номер екіпажу / підрозділу', 'Автомобіль',
    'Початковий кілометраж', 'Кінцевий кілометраж', 'Пробіг', 'Статус',
    'Ручне внесення початку', 'Ручне внесення кінця', 'Коментар', 'Час початку', 'Час завершення',
  ];
  const rows = routeSheets.map((item) => [
    formatDate(item.createdAt, true), item.fullName, item.badgeNumber, item.department, item.crewNumber || '—',
    displayVehicleFromList(vehicles, item.vehicleNumber),
    item.startOdometer, item.endOdometer,
    item.distanceKm, statusLabels[item.status], item.startManualEntry ? 'Так' : 'Ні',
    item.endManualEntry === undefined ? '' : item.endManualEntry ? 'Так' : 'Ні', item.pilotComment,
    formatDate(item.startedAt), item.endedAt ? formatDate(item.endedAt) : '',
  ]);
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pilot-route-sheets-report.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{value ?? '—'}</dd></div>;
}

function StoredPhoto({ photoId, alt }: { photoId?: string; alt: string }) {
  const [photo, setPhoto] = useState<string | null>();

  useEffect(() => {
    let active = true;
    setPhoto(undefined);
    if (!photoId) {
      setPhoto(null);
      return () => { active = false; };
    }
    void getOdometerPhoto(photoId)
      .then((dataUrl) => { if (active) setPhoto(dataUrl); })
      .catch(() => { if (active) setPhoto(null); });
    return () => { active = false; };
  }, [photoId]);

  if (photo === undefined) return <div className="no-photo">Завантаження фото…</div>;
  if (photo) return <img src={photo} alt={alt} onError={() => setPhoto(null)} />;
  return <div className="no-photo">{photoId ? 'Фото недоступне або було видалене.' : 'Фото відсутнє'}</div>;
}

export function AdminPage({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState<'route_sheets' | 'officers' | 'vehicles' | 'pilot' | 'audit'>('route_sheets');
  const [routeSheets, setRouteSheets] = useState<RouteSheet[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selected, setSelected] = useState<RouteSheet>();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RouteSheetStatus>('all');
  const [adminError, setAdminError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pilotStatus, setPilotStatus] = useState<PilotStatus>();
  const [pilotVehicles, setPilotVehicles] = useState<Vehicle[]>([]);
  const [pilotOnly, setPilotOnly] = useState(false);

  async function refreshData() {
    setLoading(true);
    setAdminError('');
    try {
      const [sheets, logs, pilot, vehicles] = await Promise.all([
        getRouteSheets(), getAuditLogs(), getPilotStatus(), getPilotVehicles(),
      ]);
      setRouteSheets(Array.isArray(sheets) ? sheets : []);
      setAuditLogs(Array.isArray(logs) ? logs : []);
      setPilotStatus(pilot);
      setPilotVehicles(Array.isArray(vehicles) ? vehicles : []);
    } catch (caught) {
      console.error('[AdminPage] data load failed', caught);
      setRouteSheets([]);
      setAuditLogs([]);
      setPilotVehicles([]);
      setAdminError('Не вдалося завантажити дані. Перевірте з’єднання з сервером.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refreshData(); }, []);

  const filteredRouteSheets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('uk-UA');
    return routeSheets.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesPilot = !pilotOnly || item.isPilot === true;
      const matchesQuery = !normalizedQuery || [item.fullName, item.badgeNumber, item.vehicleNumber]
        .some((value) => value.toLocaleLowerCase('uk-UA').includes(normalizedQuery));
      return matchesStatus && matchesPilot && matchesQuery;
    });
  }, [pilotOnly, query, routeSheets, statusFilter]);

  const stats = useMemo(() => ({
    total: routeSheets.length,
    active: routeSheets.filter((item) => item.status === 'active').length,
    completed: routeSheets.filter((item) => item.status === 'completed').length,
    needsReview: routeSheets.filter((item) => item.status === 'needs_review').length,
    distance: routeSheets.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0),
  }), [routeSheets]);

  const pilotReport = useMemo(() => {
    const sheets = routeSheets.filter((item) => item.isPilot);
    const completed = sheets.filter((item) => item.status !== 'active');
    const distance = sheets.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0);
    const manualEntries = sheets.reduce(
      (sum, item) => sum + (item.startManualEntry ? 1 : 0) + (item.endManualEntry ? 1 : 0),
      0,
    );
    const totalEntries = sheets.reduce((sum, item) => sum + 1 + (item.endOdometer === undefined ? 0 : 1), 0);
    const vehicleStats = pilotVehicles.map((vehicle) => {
      const vehicleSheets = sheets.filter((item) => Boolean(findVehicleByNumber([vehicle], item.vehicleNumber)));
      const latest = [...vehicleSheets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      return {
        ...vehicle,
        shifts: vehicleSheets.length,
        distance: vehicleSheets.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0),
        lastOdometer: latest ? latest.endOdometer ?? latest.startOdometer : undefined,
      };
    });
    return {
      sheets,
      total: sheets.length,
      completed: completed.length,
      active: sheets.filter((item) => item.status === 'active').length,
      distance,
      averageDistance: completed.length ? Math.round(distance / completed.length) : 0,
      manualEntries,
      manualPercent: totalEntries ? Math.round((manualEntries / totalEntries) * 100) : 0,
      needsReview: sheets.filter((item) => item.status === 'needs_review').length,
      comments: sheets.filter((item) => Boolean(item.pilotComment?.trim())).length,
      vehicleStats,
    };
  }, [pilotVehicles, routeSheets]);

  async function clearData() {
    if (!window.confirm('Очистити локальні тестові дані цього браузера?')) return;
    try {
      await clearOdometerPhotos();
      await clearRouteSheets();
      await clearAuditLogs();
      try {
        await addAuditLog({ action: 'Тестові дані очищено', entityType: 'admin' });
      } catch {
        // Clearing test data must still complete if the audit log is unavailable.
      }
      setRouteSheets([]);
      setAuditLogs([]);
      setSelected(undefined);
      setAdminError('');
      onLogout();
    } catch {
      setAdminError('Не вдалося зберегти дані. Перевірте налаштування браузера або очистіть тестові дані.');
    }
  }

  async function openDetails(id: string) {
    try {
      const routeSheet = await getRouteSheetById(id);
      if (routeSheet) setSelected(routeSheet);
    } catch (caught) {
      setAdminError(caught instanceof Error ? caught.message : 'Не вдалося завантажити деталі маршрутного листа.');
    }
  }

  async function exportPilotReport() {
    exportPilotCsv(pilotReport.sheets, pilotVehicles);
    await addAuditLog({ action: 'Створено пілотний CSV-звіт', entityType: 'admin', details: `Записів: ${pilotReport.total}` }).catch(() => undefined);
    setAuditLogs(await getAuditLogs().catch(() => auditLogs));
  }

  function displayVehicle(vehicleNumber: string): string {
    return displayVehicleFromList(pilotVehicles, vehicleNumber);
  }

  return (
    <main className="page admin-page">
      <section className="admin-header">
        <div><span className="eyebrow">Модуль адміністрування</span><h1>Адміністративна панель</h1><p>Реєстр маршрутних листів та службових подій</p></div>
        <div className="admin-actions">
          {(section === 'route_sheets' || section === 'pilot' || section === 'audit') && <button type="button" className="secondary compact" onClick={() => void refreshData()} disabled={loading}>Оновити</button>}
          {section === 'route_sheets' && <button type="button" className="secondary compact" onClick={() => exportCsv(routeSheets)} disabled={!routeSheets.length}>Експорт CSV</button>}
          {section === 'pilot' && <button type="button" className="secondary compact" onClick={() => void exportPilotReport()} disabled={!pilotReport.total}>Експорт пілотного звіту CSV</button>}
          {section === 'route_sheets' && <button type="button" className="danger-outline compact" onClick={() => void clearData()}>Очистити локальні тестові дані</button>}
          <button type="button" className="secondary compact" onClick={onLogout}>Вийти</button>
        </div>
      </section>

      <nav className="admin-nav" aria-label="Розділи адміністрування">
        <button className={section === 'route_sheets' ? 'active' : ''} onClick={() => setSection('route_sheets')}>Маршрутні листи</button>
        <button className={section === 'officers' ? 'active' : ''} onClick={() => setSection('officers')}>Користувачі</button>
        <button className={section === 'vehicles' ? 'active' : ''} onClick={() => setSection('vehicles')}>Автомобілі</button>
        <button className={section === 'pilot' ? 'active' : ''} onClick={() => setSection('pilot')}>Пілотне тестування</button>
        <button className={section === 'audit' ? 'active' : ''} onClick={() => setSection('audit')}>Журнал дій</button>
      </nav>

      {section === 'route_sheets' && <p className="local-cleanup-note">Очищає лише локальні тестові дані браузера. Записи backend не видаляються.</p>}

      {adminError && <p className="message error" role="alert">{adminError}</p>}

      {section === 'officers' && <OfficerDirectory />}
      {section === 'vehicles' && <VehicleDirectory />}

      <section className="pilot-overview" aria-label="Пілотне тестування" hidden={section !== 'pilot'}>
        <div className="registry-heading"><span className="eyebrow">Контрольований запуск</span><h2>Пілотне тестування</h2></div>
        <div className="pilot-info-grid">
          <div><span>Статус</span><strong className={`status ${pilotStatus?.active ? 'completed' : 'needs_review'}`}>{pilotStatus?.active ? 'Активний' : 'Неактивний'}</strong></div>
          <div><span>УПП</span><strong>{pilotStatus?.department ?? '—'}</strong></div>
          <div><span>Початок</span><strong>{pilotStatus ? formatDate(pilotStatus.startDate, true) : '—'}</strong></div>
          <div><span>Завершення</span><strong>{pilotStatus ? formatDate(pilotStatus.endDate, true) : '—'}</strong></div>
          <div><span>Автомобілі</span><strong>{pilotStatus?.vehicleCount ?? 0}</strong></div>
          <div><span>Патрульні</span><strong>{pilotStatus?.officerCount ?? 0}</strong></div>
        </div>
      </section>

      <section className="stats-grid" aria-label="Статистика маршрутних листів" hidden={section !== 'route_sheets'}>
        <article><span>Всього листів</span><strong>{stats.total}</strong></article>
        <article><span>Активні зміни</span><strong>{stats.active}</strong></article>
        <article><span>Завершені</span><strong>{stats.completed}</strong></article>
        <article className="warning-stat"><span>Потребують перевірки</span><strong>{stats.needsReview}</strong></article>
        <article><span>Сумарний пробіг</span><strong>{stats.distance.toLocaleString('uk-UA')} <small>км</small></strong></article>
      </section>

      <section className="admin-filters" aria-label="Фільтри маршрутних листів" hidden={section !== 'route_sheets'}>
        <label>Пошук
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ПІБ, жетон або номер авто" />
        </label>
        <label>Статус
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | RouteSheetStatus)}>
            <option value="all">Всі</option><option value="active">Активні</option>
            <option value="completed">Завершені</option><option value="needs_review">Потребують перевірки</option>
          </select>
        </label>
        <label className="checkbox-filter"><input type="checkbox" checked={pilotOnly} onChange={(event) => setPilotOnly(event.target.checked)} />Показати тільки пілотні записи</label>
      </section>

      {section === 'route_sheets' && (loading ? (
        <section className="empty-state"><h2>Завантажуємо маршрутні листи...</h2></section>
      ) : !routeSheets.length ? (
        <section className="empty-state"><h2>Маршрутних листів ще немає</h2><p>Створені зміни з’являться тут автоматично.</p></section>
      ) : !filteredRouteSheets.length ? (
        <section className="empty-state"><h2>Записів не знайдено</h2><p>Змініть пошуковий запит або фільтр статусу.</p></section>
      ) : (
        <section className="table-card">
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th>Дата</th><th>ПІБ</th><th>Номер жетона</th><th>УПП</th>
                <th>Екіпаж / підрозділ</th><th>Автомобіль</th><th>Початковий км</th><th>Кінцевий км</th>
                <th>Пробіг</th><th>Статус</th><th>Ручне внесення</th><th>Потребує перевірки</th>
                <th>Час початку</th><th>Час завершення</th><th>Деталі</th>
              </tr></thead>
              <tbody>{filteredRouteSheets.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.createdAt, true)}</td><td>{item.fullName}</td><td>{item.badgeNumber}</td>
                  <td>{item.department}</td><td>{item.crewNumber || '—'}</td><td>{displayVehicle(item.vehicleNumber)}</td><td>{item.startOdometer}</td>
                  <td>{item.endOdometer ?? '—'}</td><td>{item.distanceKm ?? '—'}</td>
                  <td><span className={`status ${item.status}`}>{statusLabels[item.status]}</span></td>
                  <td><span className={`meta-badge ${item.startManualEntry || item.endManualEntry ? 'manual' : ''}`}>{item.startManualEntry || item.endManualEntry ? 'Так' : 'Ні'}</span></td><td>{item.status === 'needs_review' ? 'Так' : 'Ні'}</td>
                  <td>{formatDate(item.startedAt)}</td><td>{formatDate(item.endedAt)}</td>
                  <td><button type="button" className="small-button" onClick={() => void openDetails(item.id)}>Деталі</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="pilot-report" aria-label="Звіт пілоту за тиждень" hidden={section !== 'pilot'}>
        <div className="registry-heading"><span className="eyebrow">Аналітика</span><h2>Звіт пілоту за тиждень</h2></div>
        <div className="pilot-report-grid">
          <article><span>Маршрутні листи</span><strong>{pilotReport.total}</strong></article>
          <article><span>Завершені зміни</span><strong>{pilotReport.completed}</strong></article>
          <article><span>Активні зміни</span><strong>{pilotReport.active}</strong></article>
          <article><span>Сумарний пробіг</span><strong>{pilotReport.distance} км</strong></article>
          <article><span>Середній пробіг</span><strong>{pilotReport.averageDistance} км</strong></article>
          <article><span>Ручні внесення</span><strong>{pilotReport.manualEntries} ({pilotReport.manualPercent}%)</strong></article>
          <article><span>Потребують перевірки</span><strong>{pilotReport.needsReview}</strong></article>
          <article><span>Коментарі</span><strong>{pilotReport.comments}</strong></article>
        </div>
        <div className="table-card pilot-vehicle-table"><div className="table-scroll"><table>
          <thead><tr><th>Автомобіль</th><th>Марка / модель</th><th>Кількість змін</th><th>Сумарний пробіг</th><th>Останній одометр</th></tr></thead>
          <tbody>{pilotReport.vehicleStats.map((vehicle) => (
            <tr key={vehicle.id}><td>{vehicle.displayPlateNumber || vehicle.plateNumber}</td><td>{vehicle.brand} {vehicle.model}</td><td>{vehicle.shifts}</td><td>{vehicle.distance} км</td><td>{vehicle.lastOdometer ?? '—'}</td></tr>
          ))}</tbody>
        </table></div></div>
      </section>

      <section className="audit-section" hidden={section !== 'audit'}>
        <div className="registry-heading"><span className="eyebrow">Системний реєстр</span><h2>Журнал подій</h2></div>
        {!auditLogs.length ? (
          <div className="empty-state compact-empty"><p>Записів журналу ще немає.</p></div>
        ) : (
          <div className="table-card"><div className="table-scroll">
            <table>
              <thead><tr><th>Дата/час</th><th>Дія</th><th>Тип сутності</th><th>Номер жетона</th><th>Деталі</th></tr></thead>
              <tbody>{auditLogs.map((log) => (
                <tr key={log.id}><td>{formatDate(log.createdAt)}</td><td>{log.action}</td><td>{log.entityType}</td><td>{log.badgeNumber ?? '—'}</td><td>{log.details ?? '—'}</td></tr>
              ))}</tbody>
            </table>
          </div></div>
        )}
      </section>

      {selected && (
        <div className="modal-backdrop" onMouseDown={() => setSelected(undefined)}>
          <section className="modal detail-modal" role="dialog" aria-modal="true" aria-label="Деталі маршрутного листа" onMouseDown={(event) => event.stopPropagation()}>
            <div className="section-heading"><div><span className="eyebrow">Маршрутний лист</span><h2>Деталі запису</h2></div><button type="button" className="text-button" onClick={() => setSelected(undefined)}>Закрити</button></div>
            <dl className="detail-grid">
              <DetailItem label="ID запису" value={selected.id} /><DetailItem label="ПІБ" value={selected.fullName} />
              <DetailItem label="Номер жетона" value={selected.badgeNumber} /><DetailItem label="УПП" value={selected.department} />
              <DetailItem label="Екіпаж / підрозділ" value={selected.crewNumber || '—'} />
              <DetailItem label="Автомобіль" value={displayVehicle(selected.vehicleNumber)} /><DetailItem label="Початок зміни" value={formatDate(selected.startedAt)} />
              <DetailItem label="Завершення зміни" value={formatDate(selected.endedAt)} /><DetailItem label="Початковий кілометраж" value={`${selected.startOdometer} км`} />
              <DetailItem label="Кінцевий кілометраж" value={selected.endOdometer === undefined ? '—' : `${selected.endOdometer} км`} />
              <DetailItem label="Пробіг" value={selected.distanceKm === undefined ? '—' : `${selected.distanceKm} км`} />
              <DetailItem label="OCR на початку" value={selected.startOcrValue ?? '—'} /><DetailItem label="OCR у кінці" value={selected.endOcrValue ?? '—'} />
              <DetailItem label="Ручне внесення на початку" value={selected.startManualEntry ? 'Так' : 'Ні'} />
              <DetailItem label="Ручне внесення в кінці" value={selected.endManualEntry === undefined ? '—' : selected.endManualEntry ? 'Так' : 'Ні'} />
              <DetailItem label="Статус" value={<span className={`status ${selected.status}`}>{statusLabels[selected.status]}</span>} />
              <DetailItem label="Пілотний запис" value={selected.isPilot ? 'Так' : 'Ні'} />
              <DetailItem label="Коментар" value={selected.pilotComment ?? '—'} />
            </dl>
            <div className="photo-grid detail-photos">
              <figure><figcaption>Фото на початку зміни</figcaption><StoredPhoto photoId={selected.startPhotoId} alt="Одометр на початку зміни" /></figure>
              <figure><figcaption>Фото наприкінці зміни</figcaption><StoredPhoto photoId={selected.endPhotoId} alt="Одометр наприкінці зміни" /></figure>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
