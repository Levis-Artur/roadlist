import { useEffect, useMemo, useState } from 'react';
import { OfficerDirectory } from '../components/OfficerDirectory';
import { VehicleDirectory } from '../components/VehicleDirectory';
import { AdminUsersDirectory } from '../components/AdminUsersDirectory';
import { DepartmentDirectory } from '../components/DepartmentDirectory';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { addAuditLog, clearAuditLogs, getAuditLogs } from '../services/auditService';
import { clearOdometerPhotos, getOdometerPhoto } from '../services/photoService';
import { clearRouteSheets, deleteRouteSheet, getRouteSheetById, getRouteSheets, markRouteSheetNeedsReview, updateRouteSheetAdminComment, verifyRouteSheet } from '../services/routeSheetService';
import { getOfficers } from '../services/officerService';
import { getVehicles } from '../services/vehicleService';
import {
  closeMonthlyRouteSheet,
  deleteMonthlyRouteSheet,
  getMonthlyRouteSheetById,
  getMonthlyRouteSheetPrintData,
  getMonthlyRouteSheets,
  markMonthlyRouteSheetPrinted,
  reopenMonthlyRouteSheet,
} from '../services/monthlyRouteSheetService';
import type { AuditLog, MonthlyRouteSheet, Officer, RouteSheet, RouteSheetStatus, Vehicle } from '../types';
import type { AdminUser } from '../types';
import { findVehicleByNumber, formatVehicleLabel } from '../utils/vehicleDisplay';
import { adminRoleLabels, canDeleteRecords, canManageAdminUsers, changeOwnPassword, getMyAdminProfile } from '../services/adminService';

const statusLabels: Record<RouteSheetStatus, string> = {
  active: 'Активна',
  completed: 'Завершена',
  needs_review: 'Потребує перевірки',
  verified: 'Перевірено',
};

const monthlyStatusLabels: Record<string, string> = {
  open: 'В роботі',
  closed: 'Закритий',
  archived: 'В архіві',
};

const monthNames = [
  'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
  'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень',
];

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

function isCrossMonthShift(entry: RouteSheet): boolean {
  if (!entry.endedAt) return false;
  const startedAt = new Date(entry.startedAt);
  const endedAt = new Date(entry.endedAt);
  return startedAt.getFullYear() !== endedAt.getFullYear() || startedAt.getMonth() !== endedAt.getMonth();
}

function csvCell(value: string | number | boolean | undefined): string {
  const text = value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(routeSheets: RouteSheet[]) {
  const headers = [
    'Дата', 'ПІБ', 'Номер жетона', 'УПП', 'Підрозділ', 'Номер екіпажу / підрозділу',
    'Номер автомобіля', 'Початковий кілометраж', 'Кінцевий кілометраж', 'Пробіг',
    'Статус', 'Ручне внесення початку', 'Ручне внесення кінця', 'Час початку', 'Час завершення',
    'Дата перевірки адміністратором', 'Перевірив', 'Коментар адміністратора',
  ];
  const rows = routeSheets.map((item) => [
    formatDate(item.createdAt, true), item.fullName, item.badgeNumber, item.department,
    item.unit || '—', item.crewNumber || '—', item.vehicleNumber, item.startOdometer, item.endOdometer, item.distanceKm,
    statusLabels[item.status], item.startManualEntry ? 'Так' : 'Ні',
    item.endManualEntry === undefined ? '' : item.endManualEntry ? 'Так' : 'Ні',
    formatDate(item.startedAt), item.endedAt ? formatDate(item.endedAt) : '',
    item.adminVerifiedAt ? formatDate(item.adminVerifiedAt) : '—',
    item.adminVerifiedBy || '—',
    item.adminReviewComment || '—',
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

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{value ?? '—'}</dd></div>;
}

function StoredPhoto({ photoId, alt }: { photoId?: string; alt: string }) {
  const [photo, setPhoto] = useState<string | null>();

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setPhoto(undefined);
    if (!photoId) {
      setPhoto(null);
      return () => { active = false; };
    }
    void getOdometerPhoto(photoId)
      .then((dataUrl) => {
        if (dataUrl?.startsWith('blob:')) objectUrl = dataUrl;
        if (active) setPhoto(dataUrl);
      })
      .catch(() => { if (active) setPhoto(null); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);

  if (photo === undefined) return <div className="no-photo">Завантаження фото…</div>;
  if (photo) return <img src={photo} alt={alt} onError={() => setPhoto(null)} />;
  return <div className="no-photo">{photoId ? 'Фото недоступне або було видалене.' : 'Фото відсутнє'}</div>;
}

type AdminSection = 'route_sheets' | 'monthly_route_sheets' | 'departments' | 'officers' | 'vehicles' | 'audit' | 'admins' | 'profile';

export function AdminPage({ admin, onLogout }: { admin: AdminUser; onLogout: () => void }) {
  const [section, setSection] = useState<AdminSection>('route_sheets');
  const canManageAdmins = canManageAdminUsers(admin);
  const canDelete = canDeleteRecords(admin);
  const canManageDepartments = admin.role === 'SYSTEM_OWNER' || admin.role === 'NATIONAL_ADMIN';
  const [routeSheets, setRouteSheets] = useState<RouteSheet[]>([]);
  const [monthlyRouteSheets, setMonthlyRouteSheets] = useState<MonthlyRouteSheet[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selected, setSelected] = useState<RouteSheet>();
  const [selectedMonthly, setSelectedMonthly] = useState<MonthlyRouteSheet>();
  const [printMonthly, setPrintMonthly] = useState<MonthlyRouteSheet>();
  const [reviewAction, setReviewAction] = useState<'verify' | 'comment' | 'needs_review' | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RouteSheetStatus>('all');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [adminError, setAdminError] = useState('');
  const [loading, setLoading] = useState(true);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [myProfile, setMyProfile] = useState<AdminUser>(admin);
  const [profilePasswordForm, setProfilePasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'route' | 'monthly'; id: string; label: string } | null>(null);

  async function refreshData() {
    setLoading(true);
    setAdminError('');
    try {
      const [sheets, monthlySheets, logs, officerItems, vehicleItems] = await Promise.all([
        getRouteSheets(), getMonthlyRouteSheets(), getAuditLogs(), getOfficers(), getVehicles(),
      ]);
      getMyAdminProfile().then(setMyProfile).catch(() => undefined);
      setRouteSheets(Array.isArray(sheets) ? sheets : []);
      setMonthlyRouteSheets(Array.isArray(monthlySheets) ? monthlySheets : []);
      setAuditLogs(Array.isArray(logs) ? logs : []);
      setOfficers(Array.isArray(officerItems) ? officerItems : []);
      setVehicles(Array.isArray(vehicleItems) ? vehicleItems : []);
    } catch (caught) {
      console.error('[AdminPage] data load failed', caught);
      setRouteSheets([]);
      setMonthlyRouteSheets([]);
      setAuditLogs([]);
      setOfficers([]);
      setVehicles([]);
      setAdminError('Не вдалося завантажити дані. Перевірте з’єднання з сервером.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refreshData(); }, []);

  useEffect(() => {
    if (section === 'admins' && !canManageAdmins) setSection('route_sheets');
  }, [canManageAdmins, section]);

  const filteredRouteSheets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('uk-UA');
    const normalizedDepartment = departmentFilter.trim().toLocaleLowerCase('uk-UA');
    const normalizedUnit = unitFilter.trim().toLocaleLowerCase('uk-UA');
    return routeSheets.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesDepartment = !normalizedDepartment || item.department.toLocaleLowerCase('uk-UA').includes(normalizedDepartment);
      const matchesUnit = !normalizedUnit || (item.unit || '').toLocaleLowerCase('uk-UA').includes(normalizedUnit);
      const matchesQuery = !normalizedQuery || [item.fullName, item.badgeNumber, item.vehicleNumber]
        .some((value) => value.toLocaleLowerCase('uk-UA').includes(normalizedQuery));
      return matchesStatus && matchesDepartment && matchesUnit && matchesQuery;
    });
  }, [departmentFilter, query, routeSheets, statusFilter, unitFilter]);

  const filteredMonthlyRouteSheets = useMemo(() => {
    const normalizedDepartment = departmentFilter.trim().toLocaleLowerCase('uk-UA');
    const normalizedUnit = unitFilter.trim().toLocaleLowerCase('uk-UA');
    return monthlyRouteSheets.filter((item) => (!normalizedDepartment || item.department.toLocaleLowerCase('uk-UA').includes(normalizedDepartment))
      && (!normalizedUnit || (item.unit || '').toLocaleLowerCase('uk-UA').includes(normalizedUnit)));
  }, [departmentFilter, monthlyRouteSheets, unitFilter]);

  const stats = useMemo(() => ({
    total: routeSheets.length,
    active: routeSheets.filter((item) => item.status === 'active').length,
    completed: routeSheets.filter((item) => item.status === 'completed').length,
    needsReview: routeSheets.filter((item) => item.status === 'needs_review').length,
    verified: routeSheets.filter((item) => item.status === 'verified').length,
    distance: routeSheets.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0),
    activeOfficers: officers.filter((item) => item.isActive !== false).length,
    activeVehicles: vehicles.filter((item) => item.isActive).length,
  }), [officers, routeSheets, vehicles]);

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
      setMonthlyRouteSheets([]);
      setAuditLogs([]);
      setSelected(undefined);
      setSelectedMonthly(undefined);
      setPrintMonthly(undefined);
    setAdminError('');
    onLogout();
    } catch {
      setAdminError('Не вдалося зберегти дані. Перевірте налаштування браузера або очистіть тестові дані.');
    }
  }

  function updateRouteSheetInState(routeSheet: RouteSheet) {
    setRouteSheets((items) => items.map((item) => (item.id === routeSheet.id ? routeSheet : item)));
    setSelected(routeSheet);
    setSelectedMonthly((monthly) => monthly
      ? {
          ...monthly,
          shiftEntries: monthly.shiftEntries?.map((entry) => (entry.id === routeSheet.id ? routeSheet : entry)),
        }
      : monthly);
    setPrintMonthly((monthly) => monthly
      ? {
          ...monthly,
          shiftEntries: monthly.shiftEntries?.map((entry) => (entry.id === routeSheet.id ? routeSheet : entry)),
        }
      : monthly);
  }

  function resetReviewForm() {
    setReviewAction(null);
    setReviewComment('');
    setReviewError(null);
    setReviewSuccess('');
  }

  function openReviewAction(action: 'verify' | 'comment' | 'needs_review') {
    setReviewAction(action);
    setReviewComment(selected?.adminReviewComment ?? '');
    setReviewError(null);
    setReviewSuccess('');
  }

  async function submitReviewAction(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !reviewAction) return;
    setReviewSubmitting(true);
    try {
      const updated = reviewAction === 'verify'
        ? await verifyRouteSheet(selected.id, reviewComment)
        : reviewAction === 'comment'
          ? await updateRouteSheetAdminComment(selected.id, reviewComment)
          : await markRouteSheetNeedsReview(selected.id, reviewComment);
      updateRouteSheetInState(updated);
      setReviewSuccess(reviewAction === 'comment' ? 'Коментар збережено.' : 'Адміністративну перевірку збережено.');
      setReviewAction(null);
      setReviewComment('');
      setReviewError(null);
      void refreshData();
    } catch (caught) {
      console.error('[AdminPage] review action failed', caught);
      setReviewError(caught instanceof Error ? caught.message : 'Не вдалося зберегти адміністративну перевірку.');
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function openDetails(id: string) {
    try {
      resetReviewForm();
      const routeSheet = await getRouteSheetById(id);
      if (routeSheet) setSelected(routeSheet);
    } catch (caught) {
      setAdminError(caught instanceof Error ? caught.message : 'Не вдалося завантажити деталі маршрутного листа.');
    }
  }

  async function openMonthlyDetails(id: string) {
    try {
      const monthlyRouteSheet = await getMonthlyRouteSheetById(id);
      if (monthlyRouteSheet) setSelectedMonthly(monthlyRouteSheet);
    } catch (caught) {
      setAdminError(caught instanceof Error ? caught.message : 'Не вдалося завантажити місячний маршрутний лист.');
    }
  }

  async function openMonthlyPrint(id: string) {
    try {
      const monthlyRouteSheet = await getMonthlyRouteSheetPrintData(id);
      if (monthlyRouteSheet) setPrintMonthly(monthlyRouteSheet);
    } catch (caught) {
      setAdminError(caught instanceof Error ? caught.message : 'Не вдалося підготувати друковану форму.');
    }
  }

  async function closeMonth(id: string) {
    if (!window.confirm('Ви дійсно хочете закрити місячний маршрутний лист?\nПісля закриття нові зміни за цей місяць для цього автомобіля буде заборонено.')) return;
    try {
      const updated = await closeMonthlyRouteSheet(id);
      setMonthlyRouteSheets((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setSelectedMonthly((item) => (item?.id === updated.id ? { ...item, ...updated } : item));
      setPrintMonthly((item) => (item?.id === updated.id ? { ...item, ...updated } : item));
      await refreshData();
      setAdminError('');
    } catch (caught) {
      setAdminError(caught instanceof Error ? caught.message : 'Не вдалося закрити місячний маршрутний лист.');
    }
  }

  async function reopenMonth(id: string) {
    if (!window.confirm('Повернути місячний маршрутний лист у роботу?')) return;
    try {
      const updated = await reopenMonthlyRouteSheet(id);
      setMonthlyRouteSheets((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setSelectedMonthly((item) => (item?.id === updated.id ? { ...item, ...updated } : item));
      setPrintMonthly((item) => (item?.id === updated.id ? { ...item, ...updated } : item));
      await refreshData();
      setAdminError('');
    } catch (caught) {
      setAdminError(caught instanceof Error ? caught.message : 'Не вдалося повернути місячний маршрутний лист у роботу.');
    }
  }

  async function printMonth(monthlyRouteSheet: MonthlyRouteSheet) {
    try {
      await markMonthlyRouteSheetPrinted(monthlyRouteSheet.id);
      window.setTimeout(() => window.print(), 50);
    } catch {
      window.print();
    }
  }

  async function confirmDelete(input: { reason: string; confirmText: string }) {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'route') {
      await deleteRouteSheet(deleteTarget.id, input);
      setRouteSheets((items) => items.filter((item) => item.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(undefined);
    } else {
      await deleteMonthlyRouteSheet(deleteTarget.id, input);
      setMonthlyRouteSheets((items) => items.filter((item) => item.id !== deleteTarget.id));
      if (selectedMonthly?.id === deleteTarget.id) setSelectedMonthly(undefined);
      if (printMonthly?.id === deleteTarget.id) setPrintMonthly(undefined);
    }
    await refreshData();
  }

  async function submitProfilePassword(event: React.FormEvent) {
    event.preventDefault();
    setAdminError('');
    try {
      await changeOwnPassword(profilePasswordForm);
      setProfileMessage('Пароль змінено. Увійдіть повторно з новим паролем.');
      window.setTimeout(onLogout, 700);
    } catch (caught) {
      setAdminError(caught instanceof Error ? caught.message : 'Не вдалося змінити пароль.');
    }
  }

  function displayVehicle(vehicleNumber: string): string {
    return displayVehicleFromList(vehicles, vehicleNumber);
  }

  return (
    <main className="page admin-page">
      <section className="admin-header">
        <div>
          <span className="eyebrow">Модуль адміністрування</span><h1>Адміністративна панель</h1>
          <p>Реєстр маршрутних листів та службових подій</p>
          <p>Роль: {adminRoleLabels[admin.role]}{admin.role === 'REGIONAL_ADMIN' ? ` · УПП: ${admin.department ?? '—'}` : ''}</p>
        </div>
        <div className="admin-actions">
          {(section === 'route_sheets' || section === 'monthly_route_sheets' || section === 'audit') && <button type="button" className="secondary compact" onClick={() => void refreshData()} disabled={loading}>Оновити</button>}
          {section === 'route_sheets' && <button type="button" className="secondary compact" onClick={() => exportCsv(routeSheets)} disabled={!routeSheets.length}>Експорт CSV</button>}
          {section === 'route_sheets' && <button type="button" className="danger-outline compact" onClick={() => void clearData()}>Очистити локальні тестові дані</button>}
          <button type="button" className="secondary compact" onClick={onLogout}>Вийти</button>
        </div>
      </section>

      <nav className="admin-nav" aria-label="Розділи адміністрування">
        <button className={section === 'route_sheets' ? 'active' : ''} onClick={() => setSection('route_sheets')}>Зміни</button>
        <button className={section === 'monthly_route_sheets' ? 'active' : ''} onClick={() => setSection('monthly_route_sheets')}>Маршрутні листи авто</button>
        {canManageDepartments && <button className={section === 'departments' ? 'active' : ''} onClick={() => setSection('departments')}>Управління</button>}
        <button className={section === 'officers' ? 'active' : ''} onClick={() => setSection('officers')}>Користувачі</button>
        <button className={section === 'vehicles' ? 'active' : ''} onClick={() => setSection('vehicles')}>Автомобілі</button>
        {canManageAdmins && <button className={section === 'admins' ? 'active' : ''} onClick={() => setSection('admins')}>Адміністратори</button>}
        <button className={section === 'profile' ? 'active' : ''} onClick={() => setSection('profile')}>Мій профіль</button>
        <button className={section === 'audit' ? 'active' : ''} onClick={() => setSection('audit')}>Журнал дій</button>
      </nav>

      {(section === 'route_sheets' || section === 'monthly_route_sheets') && <p className="local-cleanup-note">Очищає лише локальні тестові дані браузера. Записи backend не видаляються.</p>}

      {adminError && <p className="message error" role="alert">{adminError}</p>}

      {section === 'departments' && canManageDepartments && <DepartmentDirectory currentAdmin={admin} />}
      {section === 'officers' && <OfficerDirectory currentAdmin={admin} />}
      {section === 'vehicles' && <VehicleDirectory currentAdmin={admin} />}
      {section === 'admins' && canManageAdmins && <AdminUsersDirectory currentAdmin={admin} />}
      {section === 'profile' && (
        <section className="panel">
          <div className="section-heading"><div><span className="eyebrow">Безпека</span><h2>Мій профіль</h2></div></div>
          <dl className="detail-grid">
            <DetailItem label="ПІБ" value={myProfile.fullName} />
            <DetailItem label="Логін" value={myProfile.username} />
            <DetailItem label="Роль" value={adminRoleLabels[myProfile.role]} />
            <DetailItem label="УПП" value={myProfile.department || '—'} />
            <DetailItem label="Підрозділ" value={myProfile.unit || '—'} />
            <DetailItem label="Останній вхід" value={formatDate(myProfile.lastLoginAt ?? undefined)} />
            <DetailItem label="Дата зміни пароля" value={formatDate(myProfile.passwordChangedAt ?? undefined)} />
            <DetailItem label="Двофакторна автентифікація" value={myProfile.twoFactorEnabled ? 'Увімкнена' : 'Не увімкнена'} />
            <DetailItem label="2FA увімкнено" value={formatDate(myProfile.twoFactorEnabledAt ?? undefined)} />
          </dl>
          <form className="admin-review-form" onSubmit={(event) => void submitProfilePassword(event)}>
            <h3>Змінити пароль</h3>
            <div className="form-grid">
              <label>Поточний пароль<input type="password" value={profilePasswordForm.currentPassword} onChange={(event) => setProfilePasswordForm({ ...profilePasswordForm, currentPassword: event.target.value })} required /></label>
              <label>Новий пароль<input type="password" value={profilePasswordForm.newPassword} onChange={(event) => setProfilePasswordForm({ ...profilePasswordForm, newPassword: event.target.value })} required /><small>Мінімум 12 символів: велика і мала літера, цифра та спецсимвол.</small></label>
              <label>Повторити новий пароль<input type="password" value={profilePasswordForm.confirmPassword} onChange={(event) => setProfilePasswordForm({ ...profilePasswordForm, confirmPassword: event.target.value })} required /></label>
            </div>
            <button type="submit">Зберегти новий пароль</button>
            {profileMessage && <p className="message success" role="status">{profileMessage}</p>}
          </form>
        </section>
      )}

      <section className="stats-grid" aria-label="Статистика маршрутних листів" hidden={section !== 'route_sheets'}>
        <article><span>Всього листів</span><strong>{stats.total}</strong></article>
        <article><span>Активні зміни</span><strong>{stats.active}</strong></article>
        <article><span>Завершені</span><strong>{stats.completed}</strong></article>
        <article className="warning-stat"><span>Потребують перевірки</span><strong>{stats.needsReview}</strong></article>
        <article><span>Перевірено</span><strong>{stats.verified}</strong></article>
        <article><span>Сумарний пробіг</span><strong>{stats.distance.toLocaleString('uk-UA')} <small>км</small></strong></article>
        <article><span>Активні патрульні</span><strong>{stats.activeOfficers}</strong></article>
        <article><span>Активні автомобілі</span><strong>{stats.activeVehicles}</strong></article>
      </section>

      <section className="admin-filters" aria-label="Фільтри маршрутних листів" hidden={section !== 'route_sheets' && section !== 'monthly_route_sheets'}>
        {section === 'route_sheets' && <label>Пошук
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ПІБ, жетон або номер авто" />
        </label>}
        {admin.role !== 'REGIONAL_ADMIN' && <label>УПП
          <input value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} placeholder="Фільтр за УПП" />
        </label>}
        <label>Підрозділ
          <input value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} placeholder="Фільтр за підрозділом" />
        </label>
        {section === 'route_sheets' && <label>Статус
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | RouteSheetStatus)}>
            <option value="all">Всі</option><option value="active">Активні</option>
            <option value="completed">Завершені</option><option value="needs_review">Потребують перевірки</option><option value="verified">Перевірено</option>
          </select>
        </label>}
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
                  <td><span className={`status ${item.status}`}>{statusLabels[item.status]}</span></td>
                  <td><span className={`meta-badge ${item.startManualEntry || item.endManualEntry ? 'manual' : ''}`}>{item.startManualEntry || item.endManualEntry ? 'Так' : 'Ні'}</span></td><td>{item.status === 'needs_review' ? 'Так' : 'Ні'}</td>
                  <td>{formatDate(item.startedAt)}</td><td>{formatDate(item.endedAt)}</td>
                  <td className="row-actions">
                    <button type="button" className="small-button" onClick={() => void openDetails(item.id)}>{item.status === 'needs_review' ? 'Перевірити' : 'Деталі'}</button>
                    {canDelete && <button type="button" className="small-button danger-outline" onClick={() => setDeleteTarget({ type: 'route', id: item.id, label: item.fullName })}>Видалити</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ))}

      {section === 'monthly_route_sheets' && (loading ? (
        <section className="empty-state"><h2>Завантажуємо місячні маршрутні листи...</h2></section>
      ) : !monthlyRouteSheets.length ? (
        <section className="empty-state"><h2>Місячних маршрутних листів ще немає</h2><p>Перший лист створиться автоматично під час початку зміни на автомобілі.</p></section>
      ) : !filteredMonthlyRouteSheets.length ? (
        <section className="empty-state"><h2>Записів не знайдено</h2><p>Змініть фільтр управління або підрозділу.</p></section>
      ) : (
        <section className="table-card">
          <div className="table-scroll">
            <table>
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
                  <td>
                    <div className="button-row compact-row">
                      <button type="button" className="small-button" onClick={() => void openMonthlyDetails(item.id)}>Переглянути</button>
                      <button type="button" className="small-button" onClick={() => void openMonthlyPrint(item.id)}>Друк</button>
                      {item.status === 'closed' ? (
                        <button type="button" className="small-button" onClick={() => void reopenMonth(item.id)}>Повернути в роботу</button>
                      ) : (
                        <button type="button" className="small-button danger-mini" disabled={item.status !== 'open'} onClick={() => void closeMonth(item.id)}>Закрити місяць</button>
                      )}
                      {canDelete && <button type="button" className="small-button danger-outline" onClick={() => setDeleteTarget({ type: 'monthly', id: item.id, label: `${item.vehicleBrand} ${item.vehicleModel} ${item.displayVehicleNumber || item.vehicleNumber}` })}>Видалити</button>}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ))}

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
        <div className="modal-backdrop" onMouseDown={() => { resetReviewForm(); setSelected(undefined); }}>
          <section className="modal detail-modal" role="dialog" aria-modal="true" aria-label="Деталі маршрутного листа" onMouseDown={(event) => event.stopPropagation()}>
            <div className="section-heading"><div><span className="eyebrow">Маршрутний лист</span><h2>Деталі запису</h2></div><button type="button" className="text-button" onClick={() => { resetReviewForm(); setSelected(undefined); }}>Закрити</button></div>
            <dl className="detail-grid">
              <DetailItem label="ID запису" value={selected.id} /><DetailItem label="ПІБ" value={selected.fullName} />
              <DetailItem label="Номер жетона" value={selected.badgeNumber} /><DetailItem label="УПП" value={selected.department} />
              <DetailItem label="Підрозділ" value={selected.unit || '—'} />
              <DetailItem label="Екіпаж / підрозділ" value={selected.crewNumber || '—'} />
              <DetailItem label="Автомобіль" value={displayVehicle(selected.vehicleNumber)} /><DetailItem label="Початок зміни" value={formatDate(selected.startedAt)} />
              <DetailItem label="Завершення зміни" value={formatDate(selected.endedAt)} /><DetailItem label="Початковий кілометраж" value={`${selected.startOdometer} км`} />
              <DetailItem label="Кінцевий кілометраж" value={selected.endOdometer === undefined ? '—' : `${selected.endOdometer} км`} />
              <DetailItem label="Пробіг" value={selected.distanceKm === undefined ? '—' : `${selected.distanceKm} км`} />
              <DetailItem label="Заправка" value={selected.refueled ? 'Так' : 'Ні'} />
              <DetailItem label="Кількість літрів" value={selected.refueled ? `${selected.fuelLiters ?? '—'} л` : '—'} />
              <DetailItem label="Спосіб внесення на початку" value={selected.startManualEntry ? 'Внесено вручну' : '—'} />
              <DetailItem label="Спосіб внесення в кінці" value={selected.endManualEntry === undefined ? '—' : selected.endManualEntry ? 'Внесено вручну' : '—'} />
              <DetailItem label="Статус" value={<span className={`status ${selected.status}`}>{statusLabels[selected.status]}</span>} />
            </dl>
            <section className="admin-review-box">
              <div className="section-heading inline-heading"><div><span className="eyebrow">Адміністративна перевірка</span><h3>Стан перевірки</h3></div></div>
              <dl className="detail-grid">
                <DetailItem label="Поточний статус" value={<span className={`status ${selected.status}`}>{statusLabels[selected.status]}</span>} />
                <DetailItem label="Дата перевірки" value={formatDate(selected.adminVerifiedAt ?? undefined)} />
                <DetailItem label="Ким перевірено" value={selected.adminVerifiedBy || '—'} />
                <DetailItem label="Коментар адміністратора" value={selected.adminReviewComment || '—'} />
              </dl>
              <div className="button-row compact-row">
                {(selected.status === 'completed' || selected.status === 'needs_review') && (
                  <button type="button" className="small-button" onClick={() => openReviewAction('verify')}>Позначити як перевірено</button>
                )}
                {selected.status === 'needs_review' && (
                  <button type="button" className="small-button secondary" onClick={() => openReviewAction('comment')}>Залишити коментар</button>
                )}
                {selected.status === 'verified' && (
                  <>
                    <span className="message success compact-message">Перевірено адміністратором</span>
                    <button type="button" className="small-button danger-mini" onClick={() => openReviewAction('needs_review')}>Повернути на перевірку</button>
                  </>
                )}
                {selected.status === 'active' && <span className="field-hint">Активну незавершену зміну не можна перевірити.</span>}
              </div>
              {reviewSuccess && <p className="message success compact-review-message" role="status">{reviewSuccess}</p>}
              {reviewError && <p className="message error compact-review-message" role="alert">{reviewError}</p>}
              {reviewAction && (
                <form className="admin-review-form" onSubmit={(event) => void submitReviewAction(event)}>
                  <label>
                    Коментар адміністратора
                    <textarea
                      value={reviewComment}
                      disabled={reviewSubmitting}
                      onChange={(event) => setReviewComment(event.target.value)}
                      placeholder={reviewAction === 'verify'
                        ? 'Наприклад: Кілометраж звірено з фото одометра. Порушень не виявлено.'
                        : reviewAction === 'comment'
                          ? 'Наприклад: Потрібно додатково звірити фото кінцевого одометра.'
                          : 'Наприклад: Потрібно додатково перевірити показник кінцевого одометра.'}
                    />
                  </label>
                  <div className="modal-actions">
                    <button type="submit" disabled={reviewSubmitting}>
                      {reviewSubmitting
                        ? (reviewAction === 'verify' ? 'Підтверджуємо...' : 'Зберігаємо...')
                        : reviewAction === 'verify'
                          ? 'Підтвердити перевірку'
                          : reviewAction === 'comment'
                            ? 'Зберегти коментар'
                            : 'Залишити на перевірці'}
                    </button>
                    <button type="button" className="secondary" disabled={reviewSubmitting} onClick={() => setReviewAction(null)}>Скасувати</button>
                  </div>
                </form>
              )}
            </section>
            <div className="photo-grid detail-photos">
              <figure><figcaption>Фото на початку зміни</figcaption><StoredPhoto photoId={selected.startPhotoId} alt="Одометр на початку зміни" /></figure>
              <figure><figcaption>Фото наприкінці зміни</figcaption><StoredPhoto photoId={selected.endPhotoId} alt="Одометр наприкінці зміни" /></figure>
            </div>
          </section>
        </div>
      )}

      {selectedMonthly && (
        <div className="modal-backdrop" onMouseDown={() => setSelectedMonthly(undefined)}>
          <section className="modal detail-modal monthly-detail-modal" role="dialog" aria-modal="true" aria-label="Деталі місячного маршрутного листа" onMouseDown={(event) => event.stopPropagation()}>
            <div className="section-heading"><div><span className="eyebrow">Маршрутний лист авто</span><h2>Деталі місячного листа</h2></div><button type="button" className="text-button" onClick={() => setSelectedMonthly(undefined)}>Закрити</button></div>
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
            <div className="button-row compact-row">
              <button type="button" className="small-button" onClick={() => void openMonthlyPrint(selectedMonthly.id)}>Друк</button>
              {selectedMonthly.status === 'closed' ? (
                <button type="button" className="small-button" onClick={() => void reopenMonth(selectedMonthly.id)}>Повернути в роботу</button>
              ) : (
                <button type="button" className="small-button danger-mini" disabled={selectedMonthly.status !== 'open'} onClick={() => void closeMonth(selectedMonthly.id)}>Закрити місяць</button>
              )}
            </div>
            <div className="table-scroll nested-table">
              <table>
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
                    <td><span className={`status ${entry.status}`}>{statusLabels[entry.status]}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {printMonthly && (
        <div className="modal-backdrop print-modal-backdrop" onMouseDown={() => setPrintMonthly(undefined)}>
          <section className="modal print-modal" role="dialog" aria-modal="true" aria-label="Друк місячного маршрутного листа" onMouseDown={(event) => event.stopPropagation()}>
            <div className="section-heading no-print"><div><span className="eyebrow">Друк</span><h2>Місячний маршрутний лист</h2></div><button type="button" className="text-button" onClick={() => setPrintMonthly(undefined)}>Закрити</button></div>
            <div className="button-row no-print">
              <button type="button" onClick={() => void printMonth(printMonthly)}>Друкувати</button>
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
              <section className="signature-block">
                <p>Кінцевий кілометраж звірено: ______________________</p>
                <p>Адміністратор: ______________________</p>
                <p>Підпис: ______________________</p>
                <p>Дата: ____ / ____ / ______</p>
              </section>
            </article>
          </section>
        </div>
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          title={deleteTarget.type === 'route' ? 'Видалити маршрутний лист' : 'Видалити місячний маршрутний лист'}
          description={`Буде приховано запис: ${deleteTarget.label}. Дія доступна тільки власнику системи.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </main>
  );
}
