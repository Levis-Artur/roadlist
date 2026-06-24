import { useEffect, useMemo, useState } from 'react';
import { getAuditLogs } from '../services/auditService';
import { getMonthlyRouteSheets } from '../services/monthlyRouteSheetService';
import { getOfficers } from '../services/officerService';
import { createDepartment, createDepartmentUnit, deleteDepartment, deleteDepartmentUnit, getDepartmentUnits, getDepartments, updateDepartment, updateDepartmentUnit } from '../services/organizationService';
import { getRouteSheets } from '../services/routeSheetService';
import { getVehicles } from '../services/vehicleService';
import type { AdminUser, AuditLog, Department, DepartmentUnit, MonthlyRouteSheet, Officer, RouteSheet, Vehicle } from '../types';
import { canDeleteRecords } from '../services/adminService';
import { DeleteConfirmModal } from './DeleteConfirmModal';

const emptyDepartmentForm = { name: '', code: '', region: '', isActive: true };
const emptyUnitForm = { name: '', type: '', code: '', description: '', isActive: true };

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function inDepartment<T extends { departmentId?: string | null; department?: string | null; departmentName?: string | null }>(item: T, department: Department) {
  return item.departmentId === department.id || item.departmentName === department.name || item.department === department.name;
}

function inUnit<T extends { departmentUnitId?: string | null; unit?: string | null; departmentUnitName?: string | null }>(item: T, unit: DepartmentUnit) {
  return item.departmentUnitId === unit.id || item.departmentUnitName === unit.name || item.unit === unit.name;
}

export function DepartmentDirectory({ currentAdmin }: { currentAdmin: AdminUser }) {
  const canEdit = currentAdmin.role === 'SYSTEM_OWNER' || currentAdmin.role === 'NATIONAL_ADMIN';
  const canDelete = canDeleteRecords(currentAdmin);
  const [items, setItems] = useState<Department[]>([]);
  const [units, setUnits] = useState<DepartmentUnit[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [routeSheets, setRouteSheets] = useState<RouteSheet[]>([]);
  const [monthlySheets, setMonthlySheets] = useState<MonthlyRouteSheet[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Department | null>(null);
  const [selected, setSelected] = useState<Department | null>(null);
  const [form, setForm] = useState(emptyDepartmentForm);
  const [open, setOpen] = useState(false);
  const [unitEditing, setUnitEditing] = useState<DepartmentUnit | null>(null);
  const [unitForm, setUnitForm] = useState(emptyUnitForm);
  const [unitOpen, setUnitOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'department' | 'unit'; id: string; label: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [departmentItems, unitItems, vehicleItems, officerItems, sheetItems, monthlyItems, logs] = await Promise.all([
        getDepartments(),
        getDepartmentUnits(),
        getVehicles(),
        getOfficers(),
        getRouteSheets(),
        getMonthlyRouteSheets(),
        getAuditLogs(),
      ]);
      setItems(departmentItems);
      setUnits(unitItems);
      setVehicles(vehicleItems);
      setOfficers(officerItems);
      setRouteSheets(sheetItems);
      setMonthlySheets(monthlyItems);
      setAuditLogs(logs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося завантажити управління.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('uk-UA');
    return items.filter((item) => !normalized || `${item.name} ${item.code || ''} ${item.region || ''}`.toLocaleLowerCase('uk-UA').includes(normalized));
  }, [items, query]);

  const details = useMemo(() => {
    if (!selected) return null;
    const departmentUnits = units.filter((unit) => unit.departmentId === selected.id);
    const departmentVehicles = vehicles.filter((item) => inDepartment(item, selected));
    const departmentOfficers = officers.filter((item) => inDepartment(item, selected));
    const departmentRouteSheets = routeSheets.filter((item) => inDepartment(item, selected));
    const departmentMonthlySheets = monthlySheets.filter((item) => inDepartment(item, selected));
    const departmentAuditLogs = auditLogs.filter((log) => log.targetDepartmentId === selected.id || log.details?.includes(selected.name));
    return {
      units: departmentUnits,
      vehicles: departmentVehicles,
      officers: departmentOfficers,
      routeSheets: departmentRouteSheets,
      monthlySheets: departmentMonthlySheets,
      auditLogs: departmentAuditLogs,
      stats: {
        units: departmentUnits.length,
        vehicles: departmentVehicles.length,
        officers: departmentOfficers.length,
        activeShifts: departmentRouteSheets.filter((item) => item.status === 'active').length,
        completedShifts: departmentRouteSheets.filter((item) => item.status !== 'active').length,
        distance: departmentRouteSheets.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0),
      },
    };
  }, [auditLogs, monthlySheets, officers, routeSheets, selected, units, vehicles]);

  function showForm(item?: Department) {
    setEditing(item ?? null);
    setForm(item ? { name: item.name, code: item.code || '', region: item.region || '', isActive: item.isActive } : emptyDepartmentForm);
    setError('');
    setOpen(true);
  }

  function showUnitForm(item?: DepartmentUnit) {
    setUnitEditing(item ?? null);
    setUnitForm(item ? { name: item.name, type: item.type || '', code: item.code || '', description: item.description || '', isActive: item.isActive } : emptyUnitForm);
    setError('');
    setUnitOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Назва управління обов’язкова.');
      return;
    }
    try {
      if (editing) await updateDepartment(editing.id, { ...form, code: form.code.trim() || null, region: form.region.trim() || null });
      else await createDepartment({ ...form, code: form.code.trim() || null, region: form.region.trim() || null });
      setOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося зберегти управління.');
    }
  }

  async function saveUnit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (!unitForm.name.trim()) {
      setError('Назва внутрішнього підрозділу обов’язкова.');
      return;
    }
    try {
      const payload = {
        name: unitForm.name.trim(),
        type: unitForm.type.trim() || null,
        code: unitForm.code.trim() || null,
        description: unitForm.description.trim() || null,
        isActive: unitForm.isActive,
      };
      if (unitEditing) await updateDepartmentUnit(unitEditing.id, payload);
      else await createDepartmentUnit({ ...payload, departmentId: selected.id });
      setUnitOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося зберегти внутрішній підрозділ.');
    }
  }

  async function deactivateUnit(unit: DepartmentUnit) {
    try {
      await updateDepartmentUnit(unit.id, { isActive: false });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося деактивувати внутрішній підрозділ.');
    }
  }

  async function confirmDelete(input: { reason: string; confirmText: string }) {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'department') {
      await deleteDepartment(deleteTarget.id, input);
      if (selected?.id === deleteTarget.id) setSelected(null);
    } else {
      await deleteDepartmentUnit(deleteTarget.id, input);
    }
    await load();
  }

  return <section className="directory-panel">
    <div className="directory-toolbar">
      <div><span className="eyebrow">Оргструктура</span><h2>Управління</h2></div>
      <div className="admin-actions">
        {canEdit && <button onClick={() => showForm()}>Додати управління</button>}
        <button className="secondary compact" onClick={() => void load()}>Оновити</button>
      </div>
    </div>
    <div className="directory-filters"><label>Пошук<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Назва, код або регіон" /></label></div>
    {error && <p className="message error" role="alert">{error}</p>}
    {loading ? <div className="empty-state compact-empty">Завантаження…</div> : <div className="table-card"><div className="table-scroll"><table>
      <thead><tr><th>Назва управління</th><th>Код</th><th>Регіон</th><th>Активне</th><th>Підрозділів</th><th>Авто</th><th>Поліцейських</th><th>Маршрутних листів</th><th>Дії</th></tr></thead>
      <tbody>{filtered.map((item) => <tr key={item.id}>
        <td>{item.name}</td><td>{item.code || '—'}</td><td>{item.region || '—'}</td>
        <td><span className={`status ${item.isActive ? 'completed' : 'needs_review'}`}>{item.isActive ? 'Так' : 'Ні'}</span></td>
        <td>{item.unitCount ?? 0}</td><td>{item.vehicleCount ?? 0}</td><td>{item.officerCount ?? 0}</td><td>{item.routeSheetCount ?? 0}</td>
        <td className="row-actions">
          <button className="small-button" onClick={() => setSelected(item)}>Переглянути</button>
          {canEdit && <button className="small-button" onClick={() => showForm(item)}>Редагувати</button>}
          {canDelete && <button className="small-button danger-outline" onClick={() => setDeleteTarget({ type: 'department', id: item.id, label: item.name })}>Видалити</button>}
        </td>
      </tr>)}</tbody>
    </table></div></div>}

    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal directory-modal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading"><h2>{editing ? 'Редагування управління' : 'Нове управління'}</h2><button type="button" className="text-button" onClick={() => setOpen(false)}>Закрити</button></div>
      <div className="form-grid">
        <label>Назва управління<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label>Код<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
        <label>Регіон<input value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} /></label>
        <label className="checkbox-filter"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Активне</label>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="submit">Зберегти</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Скасувати</button></div>
    </form></div>}

    {selected && details && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}><section className="modal detail-modal department-detail-modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading modal-header"><div className="text-wrap"><span className="eyebrow">Управління</span><h2>{selected.name}</h2></div><button type="button" className="text-button" onClick={() => setSelected(null)}>Закрити</button></div>
      <div className="modal-body">
        <section className="modal-section">
          <div className="modal-section-header"><h3>Загальна інформація</h3></div>
          <div className="info-grid">
            <div className="info-item"><span className="info-label">ID</span><span className="info-value mono">{selected.id}</span></div>
            <div className="info-item"><span className="info-label">Код</span><span className="info-value">{selected.code || '—'}</span></div>
            <div className="info-item"><span className="info-label">Регіон</span><span className="info-value">{selected.region || '—'}</span></div>
            <div className="info-item"><span className="info-label">Статус</span><span className="info-value">{selected.isActive ? 'Активне' : 'Неактивне'}</span></div>
            <div className="info-item"><span className="info-label">Підрозділи</span><span className="info-value">{details.stats.units}</span></div>
            <div className="info-item"><span className="info-label">Автомобілі</span><span className="info-value">{details.stats.vehicles}</span></div>
            <div className="info-item"><span className="info-label">Поліцейські</span><span className="info-value">{details.stats.officers}</span></div>
            <div className="info-item"><span className="info-label">Активні зміни</span><span className="info-value">{details.stats.activeShifts}</span></div>
            <div className="info-item"><span className="info-label">Завершені зміни</span><span className="info-value">{details.stats.completedShifts}</span></div>
            <div className="info-item"><span className="info-label">Пробіг</span><span className="info-value">{details.stats.distance} км</span></div>
          </div>
        </section>

        <section className="modal-section">
          <div className="modal-section-header"><div><span className="eyebrow">Деталі управління</span><h3>Внутрішні підрозділи</h3></div>{canEdit && <button type="button" className="small-button" onClick={() => showUnitForm()}>Додати підрозділ</button>}</div>
          {!details.units.length ? <div className="empty-state compact-empty">Внутрішніх підрозділів ще немає.</div> : <div className="table-scroll nested-table"><table>
            <thead><tr><th>Назва</th><th>Тип</th><th>Код</th><th>Активний</th><th>Автомобілі</th><th>Поліцейські</th><th>Маршрутні листи</th><th>Дії</th></tr></thead>
            <tbody>{details.units.map((unit) => <tr key={unit.id}>
              <td>{unit.name}</td><td>{unit.type || '—'}</td><td>{unit.code || '—'}</td><td>{unit.isActive ? 'Так' : 'Ні'}</td>
              <td>{details.vehicles.filter((item) => inUnit(item, unit)).length}</td>
              <td>{details.officers.filter((item) => inUnit(item, unit)).length}</td>
              <td>{details.routeSheets.filter((item) => inUnit(item, unit)).length}</td>
              <td><div className="table-actions">
                <button className="small-button" onClick={() => showUnitForm(unit)}>Переглянути</button>
                {canEdit && <button className="small-button" onClick={() => showUnitForm(unit)}>Редагувати</button>}
                {canEdit && unit.isActive && <button className="small-button danger-mini" onClick={() => void deactivateUnit(unit)}>Деактивувати</button>}
                {canDelete && <button className="small-button danger-outline" onClick={() => setDeleteTarget({ type: 'unit', id: unit.id, label: unit.name })}>Видалити</button>}
              </div></td>
            </tr>)}</tbody>
          </table></div>}
        </section>

        <section className="modal-section">
          <div className="modal-section-header"><h3>Автомобілі</h3></div>
          {!details.vehicles.length ? <div className="empty-state compact-empty">Немає автомобілів.</div> : <div className="table-scroll nested-table"><table>
            <thead><tr><th>Автомобіль</th><th>Номер</th><th>Підрозділ</th><th>Статус</th></tr></thead>
            <tbody>{details.vehicles.map((item) => <tr key={item.id}><td>{item.brand} {item.model}</td><td>{item.displayPlateNumber || item.plateNumber}</td><td>{item.unit || '—'}</td><td>{item.isActive ? 'Активний' : 'Неактивний'}</td></tr>)}</tbody>
          </table></div>}
        </section>

        <section className="modal-section">
          <div className="modal-section-header"><h3>Поліцейські</h3></div>
          {!details.officers.length ? <div className="empty-state compact-empty">Немає поліцейських.</div> : <div className="table-scroll nested-table"><table>
            <thead><tr><th>ПІБ</th><th>Жетон</th><th>Підрозділ</th><th>Статус</th></tr></thead>
            <tbody>{details.officers.map((item) => <tr key={item.id ?? item.badgeNumber}><td>{item.fullName}</td><td>{item.badgeNumber}</td><td>{item.unit || '—'}</td><td>{item.isActive === false ? 'Неактивний' : 'Активний'}</td></tr>)}</tbody>
          </table></div>}
        </section>

        <section className="modal-section">
          <div className="modal-section-header"><h3>Маршрутні листи</h3></div>
          <p className="field-hint">Змін: {details.routeSheets.length}; місячних листів: {details.monthlySheets.length}; сумарний пробіг: {details.stats.distance} км.</p>
          {!details.routeSheets.length ? <div className="empty-state compact-empty">Немає маршрутних листів.</div> : <div className="table-scroll nested-table"><table>
            <thead><tr><th>Дата</th><th>Патрульний</th><th>Автомобіль</th><th>Пробіг</th><th>Статус</th></tr></thead>
            <tbody>{details.routeSheets.slice(0, 20).map((item) => <tr key={item.id}><td>{formatDate(item.startedAt)}</td><td>{item.fullName}</td><td>{item.displayVehicleNumber || item.vehicleNumber}</td><td>{item.distanceKm ?? '—'}</td><td>{item.status}</td></tr>)}</tbody>
          </table></div>}
        </section>

        <section className="modal-section">
          <div className="modal-section-header"><h3>Журнал дій управління</h3></div>
          {!details.auditLogs.length ? <div className="empty-state compact-empty">Журнал дій порожній.</div> : <div className="table-scroll nested-table"><table>
            <thead><tr><th>Час</th><th>Дія</th><th>Сутність</th><th>Деталі</th></tr></thead>
            <tbody>{details.auditLogs.slice(0, 20).map((log) => <tr key={log.id}><td>{formatDate(log.createdAt)}</td><td>{log.action}</td><td>{log.entityType}</td><td>{log.details || '—'}</td></tr>)}</tbody>
          </table></div>}
        </section>
      </div>
    </section></div>}

    {unitOpen && selected && <div className="modal-backdrop" onMouseDown={() => setUnitOpen(false)}><form className="modal directory-modal" onSubmit={saveUnit} onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading"><h2>{unitEditing ? 'Редагування підрозділу' : 'Новий внутрішній підрозділ'}</h2><button type="button" className="text-button" onClick={() => setUnitOpen(false)}>Закрити</button></div>
      <p className="field-hint">Управління: {selected.name}</p>
      <div className="form-grid">
        <label>Назва<input value={unitForm.name} onChange={(event) => setUnitForm({ ...unitForm, name: event.target.value })} required /></label>
        <label>Тип<input value={unitForm.type} onChange={(event) => setUnitForm({ ...unitForm, type: event.target.value })} /></label>
        <label>Код<input value={unitForm.code} onChange={(event) => setUnitForm({ ...unitForm, code: event.target.value })} /></label>
        <label>Опис<input value={unitForm.description} onChange={(event) => setUnitForm({ ...unitForm, description: event.target.value })} /></label>
        <label className="checkbox-filter"><input type="checkbox" checked={unitForm.isActive} onChange={(event) => setUnitForm({ ...unitForm, isActive: event.target.checked })} />Активний</label>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="submit">Зберегти</button><button type="button" className="secondary" onClick={() => setUnitOpen(false)}>Скасувати</button></div>
    </form></div>}

    {deleteTarget && <DeleteConfirmModal title={deleteTarget.type === 'department' ? 'Видалити управління' : 'Видалити внутрішній підрозділ'} description={`Буде приховано запис: ${deleteTarget.label}. Дія доступна тільки власнику системи.`} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}
  </section>;
}
