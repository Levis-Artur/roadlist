import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { OfficerDirectory } from '../components/OfficerDirectory';
import { VehicleDirectory } from '../components/VehicleDirectory';
import { AdminUsersDirectory } from '../components/AdminUsersDirectory';
import { DepartmentDirectory } from '../components/DepartmentDirectory';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { AdminProfileSection } from '../components/admin/AdminProfileSection';
import { AdminStatsCards } from '../components/admin/AdminStatsCards';
import { AuditLogSection } from '../components/admin/AuditLogSection';
import { MonthlySheetDetailsModal } from '../components/admin/MonthlySheetDetailsModal';
import { MonthlySheetPrintModal } from '../components/admin/MonthlySheetPrintModal';
import { MonthlySheetsSection } from '../components/admin/MonthlySheetsSection';
import { RouteSheetDetailsModal } from '../components/admin/RouteSheetDetailsModal';
import { RouteSheetsSection } from '../components/admin/RouteSheetsSection';
import { exportRouteSheetsCsv } from '../components/admin/routeSheetCsv';
import { getAuditLogs } from '../services/auditService';
import { deleteRouteSheet, getRouteSheetById, getRouteSheets, markRouteSheetNeedsReview, updateRouteSheetAdminComment, verifyRouteSheet } from '../services/routeSheetService';
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
import { canDeleteRecords, canManageAdminUsers, changeOwnPassword, getMyAdminProfile } from '../services/adminService';
import { adminRoleLabels } from '../utils/roles';

function displayVehicleFromList(vehicles: Vehicle[], vehicleNumber: string): string {
  const vehicle = findVehicleByNumber(vehicles, vehicleNumber);
  return vehicle ? formatVehicleLabel(vehicle) : vehicleNumber;
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

  async function submitReviewAction(event: FormEvent) {
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

  async function submitProfilePassword(event: FormEvent) {
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
          {section === 'route_sheets' && <button type="button" className="secondary compact" onClick={() => exportRouteSheetsCsv(routeSheets)} disabled={!routeSheets.length}>Експорт CSV</button>}
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

      {adminError && <p className="message error" role="alert">{adminError}</p>}

      {section === 'departments' && canManageDepartments && <DepartmentDirectory currentAdmin={admin} />}
      {section === 'officers' && <OfficerDirectory currentAdmin={admin} />}
      {section === 'vehicles' && <VehicleDirectory currentAdmin={admin} />}
      {section === 'admins' && canManageAdmins && <AdminUsersDirectory currentAdmin={admin} />}
      {section === 'profile' && (
        <AdminProfileSection
          myProfile={myProfile}
          profilePasswordForm={profilePasswordForm}
          profileMessage={profileMessage}
          setProfilePasswordForm={setProfilePasswordForm}
          onSubmitPassword={submitProfilePassword}
        />
      )}

      <AdminStatsCards stats={stats} hidden={section !== 'route_sheets'} />

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

      {section === 'route_sheets' && (
        <RouteSheetsSection
          loading={loading}
          routeSheets={routeSheets}
          filteredRouteSheets={filteredRouteSheets}
          canDelete={canDelete}
          displayVehicle={displayVehicle}
          onOpenDetails={(id) => void openDetails(id)}
          onRequestDelete={(target) => setDeleteTarget(target)}
        />
      )}

      {section === 'monthly_route_sheets' && (
        <MonthlySheetsSection
          loading={loading}
          monthlyRouteSheets={monthlyRouteSheets}
          filteredMonthlyRouteSheets={filteredMonthlyRouteSheets}
          canDelete={canDelete}
          onOpenDetails={(id) => void openMonthlyDetails(id)}
          onOpenPrint={(id) => void openMonthlyPrint(id)}
          onCloseMonth={(id) => void closeMonth(id)}
          onReopenMonth={(id) => void reopenMonth(id)}
          onRequestDelete={(target) => setDeleteTarget(target)}
        />
      )}

      <AuditLogSection auditLogs={auditLogs} hidden={section !== 'audit'} />

      {selected && (
        <RouteSheetDetailsModal
          selected={selected}
          reviewAction={reviewAction}
          reviewComment={reviewComment}
          reviewSubmitting={reviewSubmitting}
          reviewError={reviewError}
          reviewSuccess={reviewSuccess}
          displayVehicle={displayVehicle}
          onClose={() => { resetReviewForm(); setSelected(undefined); }}
          onOpenReviewAction={openReviewAction}
          onSubmitReviewAction={submitReviewAction}
          onReviewCommentChange={setReviewComment}
          onCancelReviewAction={() => setReviewAction(null)}
        />
      )}

      {selectedMonthly && (
        <MonthlySheetDetailsModal
          selectedMonthly={selectedMonthly}
          onClose={() => setSelectedMonthly(undefined)}
          onOpenPrint={(id) => void openMonthlyPrint(id)}
          onCloseMonth={(id) => void closeMonth(id)}
          onReopenMonth={(id) => void reopenMonth(id)}
        />
      )}

      {printMonthly && (
        <MonthlySheetPrintModal
          printMonthly={printMonthly}
          onClose={() => setPrintMonthly(undefined)}
          onPrint={(monthlyRouteSheet) => void printMonth(monthlyRouteSheet)}
        />
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
