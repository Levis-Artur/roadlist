import { useEffect, useMemo, useState } from 'react';
import { DEPARTMENTS } from '../constants/departments';
import { createVehicle, deactivateVehicle, getVehicleTransferHistory, getVehicles, transferVehicle, updateVehicle } from '../services/vehicleService';
import { getDepartments, getDepartmentUnits } from '../services/organizationService';
import { canDeleteRecords } from '../services/adminService';
import type { AdminUser, CreateVehicleInput, Department, DepartmentUnit, Vehicle, VehicleTransferHistory } from '../types';
import { normalizeVehicleNumber } from '../utils/vehicleNumber';
import { DeleteConfirmModal } from './DeleteConfirmModal';

function defaultForm(currentAdmin: AdminUser): CreateVehicleInput {
  return {
    displayPlateNumber: '',
    brand: '',
    model: '',
    department: currentAdmin.role === 'REGIONAL_ADMIN' ? currentAdmin.department || '' : DEPARTMENTS[0],
    unit: currentAdmin.role === 'REGIONAL_ADMIN' ? currentAdmin.unit || '' : '',
    departmentId: currentAdmin.role === 'REGIONAL_ADMIN' ? currentAdmin.departmentId || null : null,
    departmentName: currentAdmin.role === 'REGIONAL_ADMIN' ? currentAdmin.departmentName || currentAdmin.department || '' : DEPARTMENTS[0],
    departmentUnitId: null,
    departmentUnitName: currentAdmin.role === 'REGIONAL_ADMIN' ? currentAdmin.unit || '' : '',
    isActive: true,
  };
}

function downloadCsv(items: Vehicle[]) {
  const rows = [
    ['Номерний знак', 'Нормалізований номер', 'Марка', 'Модель', 'УПП', 'Підрозділ', 'Активний', 'Дата створення'],
    ...items.map((item) => [
      item.displayPlateNumber ?? item.plateNumber,
      item.plateNumber,
      item.brand,
      item.model,
      item.department,
      item.unit || '',
      item.isActive ? 'Так' : 'Ні',
      item.createdAt ? new Date(item.createdAt).toLocaleString('uk-UA') : '',
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'vehicles-export.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function formatTransfer(item: VehicleTransferHistory) {
  const fromName = item.fromDepartmentName || item.fromDepartment || '—';
  const fromUnit = item.fromDepartmentUnitName || item.fromUnit;
  const toName = item.toDepartmentName || item.toDepartment;
  const toUnit = item.toDepartmentUnitName || item.toUnit;
  const from = `${fromName}${fromUnit ? ` / ${fromUnit}` : ''}`;
  const to = `${toName}${toUnit ? ` / ${toUnit}` : ''}`;
  return `${from} → ${to}`;
}

export function VehicleDirectory({ currentAdmin }: { currentAdmin: AdminUser }) {
  const isRegional = currentAdmin.role === 'REGIONAL_ADMIN';
  const canTransfer = currentAdmin.role === 'SYSTEM_OWNER' || currentAdmin.role === 'NATIONAL_ADMIN' || currentAdmin.role === 'REGIONAL_ADMIN';
  const canDelete = canDeleteRecords(currentAdmin);
  const [items, setItems] = useState<Vehicle[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentUnits, setDepartmentUnits] = useState<DepartmentUnit[]>([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [unit, setUnit] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<Vehicle>();
  const [form, setForm] = useState<CreateVehicleInput>(() => defaultForm(currentAdmin));
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [transferTarget, setTransferTarget] = useState<Vehicle>();
  const [transferForm, setTransferForm] = useState<{ newDepartmentId: string; newDepartment: string; newDepartmentUnitId: string; newUnit: string; comment: string }>({ newDepartmentId: '', newDepartment: DEPARTMENTS[0], newDepartmentUnitId: '', newUnit: '', comment: '' });
  const [historyTarget, setHistoryTarget] = useState<Vehicle>();
  const [history, setHistory] = useState<VehicleTransferHistory[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [result, departmentItems, unitItems] = await Promise.all([
        getVehicles(isRegional ? { departmentId: currentAdmin.departmentId || undefined, department: currentAdmin.department || '' } : {}),
        getDepartments(),
        getDepartmentUnits(),
      ]);
      setItems(Array.isArray(result) ? result : []);
      setDepartments(departmentItems);
      setDepartmentUnits(unitItems);
    } catch (caught) {
      console.error('[VehicleDirectory] load failed', caught);
      setItems([]);
      setError('Не вдалося завантажити дані. Перевірте з’єднання з сервером.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => items.filter((item) => {
    const query = search.trim().toLocaleLowerCase('uk-UA');
    return (!query || `${item.brand} ${item.model} ${item.displayPlateNumber} ${item.plateNumber} ${item.department} ${item.unit || ''}`.toLocaleLowerCase('uk-UA').includes(query))
      && (isRegional || !department.trim() || item.department.toLocaleLowerCase('uk-UA').includes(department.trim().toLocaleLowerCase('uk-UA')))
      && (!unit.trim() || (item.unit || '').toLocaleLowerCase('uk-UA').includes(unit.trim().toLocaleLowerCase('uk-UA')))
      && (status === 'all' || item.isActive === (status === 'active'));
  }), [department, isRegional, items, search, status, unit]);

  const formUnits = useMemo(() => departmentUnits.filter((item) => item.departmentId === form.departmentId), [departmentUnits, form.departmentId]);
  const transferUnits = useMemo(() => departmentUnits.filter((item) => item.departmentId === transferForm.newDepartmentId), [departmentUnits, transferForm.newDepartmentId]);

  function patchDepartment(departmentId: string) {
    const selected = departments.find((item) => item.id === departmentId);
    setForm({ ...form, departmentId, departmentName: selected?.name || '', department: selected?.name || '', departmentUnitId: null, departmentUnitName: '', unit: '' });
  }

  function patchUnit(departmentUnitId: string) {
    const selected = departmentUnits.find((item) => item.id === departmentUnitId);
    setForm({ ...form, departmentUnitId: departmentUnitId || null, departmentUnitName: selected?.name || '', unit: selected?.name || '' });
  }

  function blankForm(): CreateVehicleInput {
    const departmentItem = isRegional
      ? departments.find((item) => item.id === currentAdmin.departmentId) || departments.find((item) => item.name === currentAdmin.department)
      : departments[0];
    return {
      ...defaultForm(currentAdmin),
      departmentId: departmentItem?.id || currentAdmin.departmentId || null,
      department: departmentItem?.name || currentAdmin.department || DEPARTMENTS[0],
      departmentName: departmentItem?.name || currentAdmin.departmentName || currentAdmin.department || DEPARTMENTS[0],
    };
  }

  function showForm(item?: Vehicle) {
    setEditing(item);
    setError('');
    setForm(item ? {
      displayPlateNumber: item.displayPlateNumber ?? item.plateNumber,
      brand: item.brand,
      model: item.model,
      department: isRegional ? currentAdmin.department || item.department : item.department,
      unit: item.unit || '',
      departmentId: isRegional ? currentAdmin.departmentId || item.departmentId || null : item.departmentId || null,
      departmentName: item.departmentName || item.department,
      departmentUnitId: item.departmentUnitId || null,
      departmentUnitName: item.departmentUnitName || item.unit || '',
      isActive: item.isActive,
    } : blankForm());
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const payload = {
      ...form,
      department: isRegional ? currentAdmin.department || '' : form.department,
      departmentId: isRegional ? currentAdmin.departmentId || form.departmentId : form.departmentId,
      departmentName: isRegional ? currentAdmin.departmentName || currentAdmin.department || form.department : form.departmentName || form.department,
      unit: form.unit?.trim() || null,
      departmentUnitId: form.departmentUnitId || null,
      departmentUnitName: form.departmentUnitName || form.unit?.trim() || null,
    };
    if (!payload.displayPlateNumber.trim() || !payload.brand.trim() || !payload.model.trim() || !payload.department.trim()) {
      setError('Заповніть номерний знак, марку, модель та УПП.');
      return;
    }
    try {
      if (editing) await updateVehicle(editing.id, payload);
      else await createVehicle(payload);
      setOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося зберегти автомобіль.');
    }
  }

  async function deactivate(item: Vehicle, input: { reason: string; confirmText: string }) {
    try {
      await deactivateVehicle(item.id, input);
      await load();
      setDeleteTarget(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося видалити автомобіль.');
    }
  }

  function openTransfer(item: Vehicle) {
    setTransferTarget(item);
    setTransferForm({ newDepartmentId: item.departmentId || currentAdmin.departmentId || '', newDepartment: item.departmentName || item.department, newDepartmentUnitId: item.departmentUnitId || '', newUnit: item.departmentUnitName || item.unit || '', comment: '' });
    setError('');
  }

  async function submitTransfer(event: React.FormEvent) {
    event.preventDefault();
    if (!transferTarget) return;
    setError('');
    try {
      await transferVehicle(transferTarget.id, {
        newDepartmentId: transferForm.newDepartmentId || undefined,
        newDepartment: transferForm.newDepartment,
        newDepartmentUnitId: transferForm.newDepartmentUnitId || null,
        newUnit: transferForm.newUnit.trim() || null,
        comment: transferForm.comment.trim() || null,
      });
      setTransferTarget(undefined);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося перемістити автомобіль.');
    }
  }

  async function showHistory(item: Vehicle) {
    setHistoryTarget(item);
    setHistory([]);
    try {
      setHistory(await getVehicleTransferHistory(item.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося завантажити історію переміщень.');
    }
  }

  return <section className="directory-panel">
    <div className="directory-toolbar">
      <div><span className="eyebrow">Довідник</span><h2>Автомобілі</h2></div>
      <div className="admin-actions">
        <button onClick={() => showForm()}>Додати автомобіль</button>
        <button className="secondary compact" onClick={() => void load()}>Оновити</button>
        <button className="secondary compact" onClick={() => downloadCsv(filtered)} disabled={!filtered.length}>Експорт CSV</button>
      </div>
    </div>

    <div className="directory-filters">
      <label>Пошук<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Номер, марка або модель" /></label>
      {!isRegional && <label>УПП<input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Фільтр за УПП" /></label>}
      {isRegional && <label>УПП<input value={currentAdmin.department || '—'} readOnly /></label>}
      <label>Підрозділ<input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Фільтр за підрозділом" /></label>
      <label>Статус<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Всі</option><option value="active">Активні</option><option value="inactive">Неактивні</option></select></label>
    </div>

    {error && <p className="message error" role="alert">{error}</p>}

    {loading ? <div className="empty-state compact-empty">Завантаження…</div> : !items.length ? <div className="empty-state compact-empty"><p>Автомобілів ще не додано.</p></div> : !filtered.length ? <div className="empty-state compact-empty"><p>Автомобілів за вибраними фільтрами не знайдено.</p></div> : <div className="table-card"><div className="table-scroll"><table className="responsive-table vehicles-table"><thead><tr><th>Номерний знак</th><th>Нормалізований номер</th><th>Марка</th><th>Модель</th><th>УПП</th><th>Підрозділ</th><th>Активний</th><th>Дата створення</th><th>Дії</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td>{item.displayPlateNumber ?? item.plateNumber}</td><td>{item.plateNumber}</td><td>{item.brand}</td><td>{item.model}</td><td>{item.department}</td><td>{item.unit || '—'}</td><td><span className={`status ${item.isActive ? 'completed' : 'needs_review'}`}>{item.isActive ? 'Так' : 'Ні'}</span></td><td>{item.createdAt ? new Date(item.createdAt).toLocaleString('uk-UA') : '—'}</td><td className="row-actions"><button className="small-button" onClick={() => showForm(item)}>Редагувати</button>{canTransfer && <button className="small-button" onClick={() => openTransfer(item)}>Перемістити</button>}<button className="small-button secondary" onClick={() => void showHistory(item)}>Історія</button>{canDelete && item.isActive && <button className="small-button danger-outline" onClick={() => setDeleteTarget(item)}>Видалити</button>}</td></tr>)}</tbody></table></div></div>}

    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal directory-modal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading"><h2>{editing ? 'Редагування автомобіля' : 'Новий автомобіль'}</h2><button type="button" className="text-button" onClick={() => setOpen(false)}>Закрити</button></div>
      <datalist id="vehicle-department-options">{DEPARTMENTS.map((item) => <option key={item} value={item} />)}</datalist>
      <div className="form-grid">
        <label>Номерний знак для відображення<input value={form.displayPlateNumber} onChange={(event) => setForm({ ...form, displayPlateNumber: event.target.value })} placeholder="АА5200МН" required /><small>Нормалізований номер: {normalizeVehicleNumber(form.displayPlateNumber) || '—'}</small></label>
        <label>Марка<input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} required /></label>
        <label>Модель<input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} required /></label>
        <label>Управління<select value={form.departmentId || ''} onChange={(event) => patchDepartment(event.target.value)} disabled={isRegional} required><option value="">Оберіть управління</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Внутрішній підрозділ<select value={form.departmentUnitId || ''} onChange={(event) => patchUnit(event.target.value)}><option value="">Без підрозділу</option>{formUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="checkbox-filter"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Активний</label>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="submit">Зберегти</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Скасувати</button></div>
    </form></div>}

    {transferTarget && <div className="modal-backdrop" onMouseDown={() => setTransferTarget(undefined)}><form className="modal directory-modal" onSubmit={submitTransfer} onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading"><h2>Переміщення автомобіля</h2><button type="button" className="text-button" onClick={() => setTransferTarget(undefined)}>Закрити</button></div>
      <p className="muted">{transferTarget.brand} {transferTarget.model} — {transferTarget.displayPlateNumber ?? transferTarget.plateNumber}</p>
      <div className="form-grid">
        <label>Нове управління<select value={transferForm.newDepartmentId} onChange={(event) => { const selected = departments.find((item) => item.id === event.target.value); setTransferForm({ ...transferForm, newDepartmentId: event.target.value, newDepartment: selected?.name || '', newDepartmentUnitId: '', newUnit: '' }); }} disabled={isRegional} required><option value="">Оберіть управління</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Новий підрозділ<select value={transferForm.newDepartmentUnitId} onChange={(event) => { const selected = departmentUnits.find((item) => item.id === event.target.value); setTransferForm({ ...transferForm, newDepartmentUnitId: event.target.value, newUnit: selected?.name || '' }); }}><option value="">Без підрозділу</option>{transferUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Коментар переміщення<textarea value={transferForm.comment} onChange={(event) => setTransferForm({ ...transferForm, comment: event.target.value })} placeholder="Причина або службовий коментар" /></label>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="submit">Перемістити</button><button type="button" className="secondary" onClick={() => setTransferTarget(undefined)}>Скасувати</button></div>
    </form></div>}

    {historyTarget && <div className="modal-backdrop" onMouseDown={() => setHistoryTarget(undefined)}><div className="modal directory-modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading"><h2>Історія переміщень</h2><button type="button" className="text-button" onClick={() => setHistoryTarget(undefined)}>Закрити</button></div>
      <p className="muted">{historyTarget.brand} {historyTarget.model} — {historyTarget.displayPlateNumber ?? historyTarget.plateNumber}</p>
      {!history.length ? <div className="empty-state compact-empty"><p>Переміщень ще не зафіксовано.</p></div> : <div className="table-scroll"><table className="responsive-table transfer-history-table"><thead><tr><th>Дата</th><th>Переміщення</th><th>Адміністратор</th><th>Коментар</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{new Date(item.transferredAt).toLocaleString('uk-UA')}</td><td>{formatTransfer(item)}</td><td>{item.transferredByUsername || '—'}</td><td>{item.comment || '—'}</td></tr>)}</tbody></table></div>}
    </div></div>}
    {deleteTarget && <DeleteConfirmModal title="Видалити автомобіль" description={`Буде приховано автомобіль: ${deleteTarget.brand} ${deleteTarget.model} — ${deleteTarget.displayPlateNumber ?? deleteTarget.plateNumber}.`} onCancel={() => setDeleteTarget(null)} onConfirm={(input) => deactivate(deleteTarget, input)} />}
  </section>;
}
