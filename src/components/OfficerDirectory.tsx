import { useEffect, useMemo, useState } from 'react';
import { createOfficer, deactivateOfficer, getOfficers, PIN_ERROR, updateOfficer } from '../services/officerService';
import { getDepartments, getDepartmentUnits } from '../services/organizationService';
import { canDeleteRecords } from '../services/adminService';
import type { AdminUser, CreateOfficerInput, Department, DepartmentUnit, Officer } from '../types';
import { BADGE_NUMBER_ERROR, isValidBadgeNumber, sanitizeBadgeNumber } from '../utils/badgeNumber';
import { downloadCsvFile } from '../utils/csv';
import { formatDate } from '../utils/format';
import { DeleteConfirmModal } from './DeleteConfirmModal';

function defaultForm(currentAdmin: AdminUser): CreateOfficerInput {
  const regionalDepartment = currentAdmin.departmentName || currentAdmin.department || '';
  return {
    badgeNumber: '',
    fullName: '',
    department: currentAdmin.role === 'REGIONAL_ADMIN' ? regionalDepartment : '',
    unit: currentAdmin.role === 'REGIONAL_ADMIN' ? currentAdmin.unit || '' : '',
    departmentId: currentAdmin.role === 'REGIONAL_ADMIN' ? currentAdmin.departmentId || null : null,
    departmentName: currentAdmin.role === 'REGIONAL_ADMIN' ? regionalDepartment : '',
    departmentUnitId: null,
    departmentUnitName: currentAdmin.role === 'REGIONAL_ADMIN' ? currentAdmin.unit || '' : '',
    pin: '',
    isActive: true,
  };
}

function downloadCsv(officers: Officer[]) {
  const rows = [
    ['Номер жетона', 'ПІБ', 'УПП', 'Підрозділ', 'Статус', 'PIN встановлено', 'Дата створення'],
    ...officers.map((item) => [
      item.badgeNumber,
      item.fullName,
      item.department,
      item.unit || '',
      item.isActive === false ? 'Неактивний' : 'Активний',
      item.hasPin ? 'Так' : 'Ні',
      item.createdAt ? formatDate(item.createdAt) : '',
    ]),
  ];
  downloadCsvFile('officers-export.csv', rows);
}

export function OfficerDirectory({ currentAdmin }: { currentAdmin: AdminUser }) {
  const isRegional = currentAdmin.role === 'REGIONAL_ADMIN';
  const canDelete = canDeleteRecords(currentAdmin);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentUnits, setDepartmentUnits] = useState<DepartmentUnit[]>([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [unit, setUnit] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<Officer>();
  const [form, setForm] = useState<CreateOfficerInput>(() => defaultForm(currentAdmin));
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Officer | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [result, departmentItems, unitItems] = await Promise.all([
        getOfficers(isRegional ? { departmentId: currentAdmin.departmentId || undefined, department: currentAdmin.department || '' } : {}),
        getDepartments(),
        getDepartmentUnits(),
      ]);
      setOfficers(Array.isArray(result) ? result : []);
      setDepartments(departmentItems);
      setDepartmentUnits(unitItems);
    } catch (caught) {
      console.error('[OfficerDirectory] load failed', caught);
      setOfficers([]);
      setError('Не вдалося завантажити дані. Перевірте з’єднання з сервером.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => officers.filter((item) => {
    const query = search.trim().toLocaleLowerCase('uk-UA');
    return (!query || `${item.fullName} ${item.badgeNumber} ${item.department} ${item.unit || ''}`.toLocaleLowerCase('uk-UA').includes(query))
      && (isRegional || !department.trim() || item.department.toLocaleLowerCase('uk-UA').includes(department.trim().toLocaleLowerCase('uk-UA')))
      && (!unit.trim() || (item.unit || '').toLocaleLowerCase('uk-UA').includes(unit.trim().toLocaleLowerCase('uk-UA')))
      && (status === 'all' || Boolean(item.isActive !== false) === (status === 'active'));
  }), [department, isRegional, officers, search, status, unit]);

  const formUnits = useMemo(() => departmentUnits.filter((item) => item.departmentId === form.departmentId), [departmentUnits, form.departmentId]);

  function patchDepartment(departmentId: string) {
    const selected = departments.find((item) => item.id === departmentId);
    setForm({ ...form, departmentId, departmentName: selected?.name || '', department: selected?.name || '', departmentUnitId: null, departmentUnitName: '', unit: '' });
  }

  function patchUnit(departmentUnitId: string) {
    const selected = departmentUnits.find((item) => item.id === departmentUnitId);
    setForm({ ...form, departmentUnitId: departmentUnitId || null, departmentUnitName: selected?.name || '', unit: selected?.name || '' });
  }

  function blankForm(): CreateOfficerInput {
    const departmentItem = isRegional
      ? departments.find((item) => item.id === currentAdmin.departmentId) || departments.find((item) => item.name === currentAdmin.department)
      : departments[0];
    return {
      ...defaultForm(currentAdmin),
      departmentId: departmentItem?.id || currentAdmin.departmentId || null,
      department: departmentItem?.name || currentAdmin.departmentName || currentAdmin.department || '',
      departmentName: departmentItem?.name || currentAdmin.departmentName || currentAdmin.department || '',
    };
  }

  function showForm(officer?: Officer) {
    setEditing(officer);
    setError('');
    setSuccess('');
    setForm(officer ? {
      badgeNumber: officer.badgeNumber,
      fullName: officer.fullName,
      department: isRegional ? currentAdmin.department || officer.department : officer.department,
      unit: officer.unit || '',
      departmentId: isRegional ? currentAdmin.departmentId || officer.departmentId || null : officer.departmentId || null,
      departmentName: officer.departmentName || officer.department,
      departmentUnitId: officer.departmentUnitId || null,
      departmentUnitName: officer.departmentUnitName || officer.unit || '',
      pin: '',
      isActive: officer.isActive !== false,
    } : blankForm());
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const normalizedForm = {
      ...form,
      department: isRegional ? currentAdmin.department || '' : form.department,
      departmentId: isRegional ? currentAdmin.departmentId || form.departmentId : form.departmentId,
      departmentName: isRegional ? currentAdmin.departmentName || currentAdmin.department || form.department : form.departmentName || form.department,
      unit: form.unit?.trim() || null,
      departmentUnitId: form.departmentUnitId || null,
      departmentUnitName: form.departmentUnitName || form.unit?.trim() || null,
    };
    if (!isValidBadgeNumber(normalizedForm.badgeNumber)) {
      setError(BADGE_NUMBER_ERROR);
      return;
    }
    if ((!editing && !/^\d{4,8}$/.test(normalizedForm.pin)) || (editing && normalizedForm.pin && !/^\d{4,8}$/.test(normalizedForm.pin))) {
      setError(PIN_ERROR);
      return;
    }
    if (!normalizedForm.fullName.trim() || !normalizedForm.department.trim()) {
      setError('Заповніть ПІБ та УПП.');
      return;
    }
    try {
      const isEditing = Boolean(editing?.id);
      if (editing?.id) await updateOfficer(editing.id, normalizedForm);
      else await createOfficer(normalizedForm);
      setOpen(false);
      await load();
      setSuccess(isEditing ? 'Дані патрульного оновлено.' : 'Патрульного додано.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося зберегти патрульного.');
    }
  }

  async function deactivate(item: Officer, input: { reason: string; confirmText: string }) {
    if (!item.id) return;
    try {
      await deactivateOfficer(item.id, input);
      await load();
      setDeleteTarget(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося видалити патрульного.');
    }
  }

  return <section className="directory-panel">
    <div className="directory-toolbar">
      <div><span className="eyebrow">Довідник</span><h2>Користувачі</h2></div>
      <div className="admin-actions">
        <button onClick={() => showForm()} disabled={!isRegional && !departments.length}>Додати патрульного</button>
        <button className="secondary compact" onClick={() => void load()}>Оновити</button>
        <button className="secondary compact" onClick={() => downloadCsv(filtered)} disabled={!filtered.length}>Експорт CSV</button>
      </div>
    </div>

    <div className="directory-filters">
      <label>Пошук<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ПІБ, жетон або підрозділ" /></label>
      {!isRegional && <label>УПП<input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Фільтр за УПП" /></label>}
      {isRegional && <label>УПП<input value={currentAdmin.department || '—'} readOnly /></label>}
      <label>Підрозділ<input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Фільтр за підрозділом" /></label>
      <label>Статус<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Всі</option><option value="active">Активні</option><option value="inactive">Неактивні</option></select></label>
    </div>

    {error && <p className="message error" role="alert">{error}</p>}
    {success && <p className="message success" role="status">{success}</p>}

    {loading ? <div className="empty-state compact-empty">Завантаження…</div> : !officers.length ? <div className="empty-state compact-empty"><p>Користувачів ще не додано.</p></div> : !filtered.length ? <div className="empty-state compact-empty"><p>Користувачів за вибраними фільтрами не знайдено.</p></div> : <div className="table-card"><div className="table-scroll"><table className="responsive-table officers-table"><thead><tr><th>Жетон</th><th>ПІБ</th><th>УПП</th><th>Підрозділ</th><th>Активний</th><th>PIN встановлено</th><th>Дата створення</th><th>Дії</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id ?? item.badgeNumber}><td>{item.badgeNumber}</td><td>{item.fullName}</td><td>{item.department}</td><td>{item.unit || '—'}</td><td><span className={`status ${item.isActive === false ? 'needs_review' : 'completed'}`}>{item.isActive === false ? 'Ні' : 'Так'}</span></td><td>{item.hasPin ? 'Так' : 'Ні'}</td><td>{formatDate(item.createdAt)}</td><td className="row-actions"><button className="small-button" onClick={() => showForm(item)}>Редагувати</button>{canDelete && item.isActive !== false && <button className="small-button danger-outline" onClick={() => setDeleteTarget(item)}>Видалити</button>}</td></tr>)}</tbody></table></div></div>}

    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal directory-modal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading"><h2>{editing ? 'Редагування патрульного' : 'Новий патрульний'}</h2><button type="button" className="text-button" onClick={() => setOpen(false)}>Закрити</button></div>
      <div className="form-grid">
        <label>Номер жетона<input value={form.badgeNumber} onChange={(event) => setForm({ ...form, badgeNumber: sanitizeBadgeNumber(event.target.value) })} onPaste={(event) => { event.preventDefault(); setForm({ ...form, badgeNumber: sanitizeBadgeNumber(event.clipboardData.getData('text')) }); }} inputMode="numeric" maxLength={7} placeholder="0000001" required /></label>
        <label>{editing ? 'Новий PIN' : 'PIN'}<input type="password" value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value.replace(/\D/g, '').slice(0, 8) })} inputMode="numeric" minLength={4} maxLength={8} placeholder={editing ? 'Залиште порожнім без змін' : '4–8 цифр'} required={!editing} /><small>{editing ? 'Необов’язково. Поточний PIN не показується.' : 'Від 4 до 8 цифр.'}</small></label>
        <label>ПІБ<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required /></label>
        <label>Управління<select value={form.departmentId || ''} onChange={(event) => patchDepartment(event.target.value)} disabled={isRegional} required><option value="">Оберіть управління</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Внутрішній підрозділ<select value={form.departmentUnitId || ''} onChange={(event) => patchUnit(event.target.value)}><option value="">Без підрозділу</option>{formUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="checkbox-filter"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Активний</label>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="submit">Зберегти</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Скасувати</button></div>
    </form></div>}
    {deleteTarget && <DeleteConfirmModal title="Видалити патрульного" description={`Буде приховано користувача: ${deleteTarget.fullName}.`} onCancel={() => setDeleteTarget(null)} onConfirm={(input) => deactivate(deleteTarget, input)} />}
  </section>;
}
