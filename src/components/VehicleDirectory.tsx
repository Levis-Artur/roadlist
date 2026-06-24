import { useEffect, useMemo, useState } from 'react';
import { DEPARTMENTS } from '../constants/departments';
import { createVehicle, deactivateVehicle, getVehicleTransferHistory, getVehicles, transferVehicle, updateVehicle } from '../services/vehicleService';
import type { AdminUser, CreateVehicleInput, Vehicle, VehicleTransferHistory } from '../types';
import { normalizeVehicleNumber } from '../utils/vehicleNumber';

function defaultForm(currentAdmin: AdminUser): CreateVehicleInput {
  return {
    displayPlateNumber: '',
    brand: '',
    model: '',
    department: currentAdmin.role === 'REGIONAL_ADMIN' ? currentAdmin.department || '' : DEPARTMENTS[0],
    unit: currentAdmin.role === 'REGIONAL_ADMIN' ? currentAdmin.unit || '' : '',
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
  const from = `${item.fromDepartment || '—'}${item.fromUnit ? ` / ${item.fromUnit}` : ''}`;
  const to = `${item.toDepartment}${item.toUnit ? ` / ${item.toUnit}` : ''}`;
  return `${from} → ${to}`;
}

export function VehicleDirectory({ currentAdmin }: { currentAdmin: AdminUser }) {
  const isRegional = currentAdmin.role === 'REGIONAL_ADMIN';
  const canTransfer = currentAdmin.role === 'SYSTEM_OWNER' || currentAdmin.role === 'NATIONAL_ADMIN';
  const [items, setItems] = useState<Vehicle[]>([]);
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
  const [transferForm, setTransferForm] = useState<{ newDepartment: string; newUnit: string; comment: string }>({ newDepartment: DEPARTMENTS[0], newUnit: '', comment: '' });
  const [historyTarget, setHistoryTarget] = useState<Vehicle>();
  const [history, setHistory] = useState<VehicleTransferHistory[]>([]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await getVehicles(isRegional ? { department: currentAdmin.department || '' } : {});
      setItems(Array.isArray(result) ? result : []);
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

  function showForm(item?: Vehicle) {
    setEditing(item);
    setError('');
    setForm(item ? {
      displayPlateNumber: item.displayPlateNumber ?? item.plateNumber,
      brand: item.brand,
      model: item.model,
      department: isRegional ? currentAdmin.department || item.department : item.department,
      unit: item.unit || '',
      isActive: item.isActive,
    } : defaultForm(currentAdmin));
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const payload = {
      ...form,
      department: isRegional ? currentAdmin.department || '' : form.department,
      unit: form.unit?.trim() || null,
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

  async function deactivate(item: Vehicle) {
    if (!window.confirm(`Деактивувати ${item.brand} ${item.model} — ${item.displayPlateNumber ?? item.plateNumber}?`)) return;
    try {
      await deactivateVehicle(item.id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося деактивувати автомобіль.');
    }
  }

  function openTransfer(item: Vehicle) {
    setTransferTarget(item);
    setTransferForm({ newDepartment: item.department, newUnit: item.unit || '', comment: '' });
    setError('');
  }

  async function submitTransfer(event: React.FormEvent) {
    event.preventDefault();
    if (!transferTarget) return;
    setError('');
    try {
      await transferVehicle(transferTarget.id, {
        newDepartment: transferForm.newDepartment,
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

    {loading ? <div className="empty-state compact-empty">Завантаження…</div> : !items.length ? <div className="empty-state compact-empty"><p>Автомобілів ще не додано.</p></div> : !filtered.length ? <div className="empty-state compact-empty"><p>Автомобілів за вибраними фільтрами не знайдено.</p></div> : <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Номерний знак</th><th>Нормалізований номер</th><th>Марка</th><th>Модель</th><th>УПП</th><th>Підрозділ</th><th>Активний</th><th>Дата створення</th><th>Дії</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td>{item.displayPlateNumber ?? item.plateNumber}</td><td>{item.plateNumber}</td><td>{item.brand}</td><td>{item.model}</td><td>{item.department}</td><td>{item.unit || '—'}</td><td><span className={`status ${item.isActive ? 'completed' : 'needs_review'}`}>{item.isActive ? 'Так' : 'Ні'}</span></td><td>{item.createdAt ? new Date(item.createdAt).toLocaleString('uk-UA') : '—'}</td><td className="row-actions"><button className="small-button" onClick={() => showForm(item)}>Редагувати</button>{canTransfer && <button className="small-button" onClick={() => openTransfer(item)}>Перемістити</button>}<button className="small-button secondary" onClick={() => void showHistory(item)}>Історія</button>{item.isActive && <button className="small-button danger-outline" onClick={() => void deactivate(item)}>Деактивувати</button>}</td></tr>)}</tbody></table></div></div>}

    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal directory-modal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading"><h2>{editing ? 'Редагування автомобіля' : 'Новий автомобіль'}</h2><button type="button" className="text-button" onClick={() => setOpen(false)}>Закрити</button></div>
      <datalist id="vehicle-department-options">{DEPARTMENTS.map((item) => <option key={item} value={item} />)}</datalist>
      <div className="form-grid">
        <label>Номерний знак для відображення<input value={form.displayPlateNumber} onChange={(event) => setForm({ ...form, displayPlateNumber: event.target.value })} placeholder="АА5200МН" required /><small>Нормалізований номер: {normalizeVehicleNumber(form.displayPlateNumber) || '—'}</small></label>
        <label>Марка<input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} required /></label>
        <label>Модель<input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} required /></label>
        <label>УПП<input value={isRegional ? currentAdmin.department || '' : form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} list="vehicle-department-options" readOnly={isRegional} required /></label>
        <label>Підрозділ<input value={form.unit || ''} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="Необов’язково" /></label>
        <label className="checkbox-filter"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Активний</label>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="submit">Зберегти</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Скасувати</button></div>
    </form></div>}

    {transferTarget && <div className="modal-backdrop" onMouseDown={() => setTransferTarget(undefined)}><form className="modal directory-modal" onSubmit={submitTransfer} onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading"><h2>Переміщення автомобіля</h2><button type="button" className="text-button" onClick={() => setTransferTarget(undefined)}>Закрити</button></div>
      <p className="muted">{transferTarget.brand} {transferTarget.model} — {transferTarget.displayPlateNumber ?? transferTarget.plateNumber}</p>
      <datalist id="transfer-department-options">{DEPARTMENTS.map((item) => <option key={item} value={item} />)}</datalist>
      <div className="form-grid">
        <label>Нове управління<input value={transferForm.newDepartment} onChange={(event) => setTransferForm({ ...transferForm, newDepartment: event.target.value })} list="transfer-department-options" required /></label>
        <label>Новий підрозділ<input value={transferForm.newUnit} onChange={(event) => setTransferForm({ ...transferForm, newUnit: event.target.value })} placeholder="Необов’язково" /></label>
        <label>Коментар переміщення<textarea value={transferForm.comment} onChange={(event) => setTransferForm({ ...transferForm, comment: event.target.value })} placeholder="Причина або службовий коментар" /></label>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="submit">Перемістити</button><button type="button" className="secondary" onClick={() => setTransferTarget(undefined)}>Скасувати</button></div>
    </form></div>}

    {historyTarget && <div className="modal-backdrop" onMouseDown={() => setHistoryTarget(undefined)}><div className="modal directory-modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading"><h2>Історія переміщень</h2><button type="button" className="text-button" onClick={() => setHistoryTarget(undefined)}>Закрити</button></div>
      <p className="muted">{historyTarget.brand} {historyTarget.model} — {historyTarget.displayPlateNumber ?? historyTarget.plateNumber}</p>
      {!history.length ? <div className="empty-state compact-empty"><p>Переміщень ще не зафіксовано.</p></div> : <div className="table-scroll"><table><thead><tr><th>Дата</th><th>Переміщення</th><th>Адміністратор</th><th>Коментар</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{new Date(item.transferredAt).toLocaleString('uk-UA')}</td><td>{formatTransfer(item)}</td><td>{item.transferredByUsername || '—'}</td><td>{item.comment || '—'}</td></tr>)}</tbody></table></div>}
    </div></div>}
  </section>;
}
