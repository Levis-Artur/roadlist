import { useEffect, useMemo, useState } from 'react';
import { DEPARTMENTS } from '../constants/departments';
import { createOfficer, deactivateOfficer, getOfficers, PIN_ERROR, updateOfficer } from '../services/officerService';
import type { AdminUser, CreateOfficerInput, Officer } from '../types';
import { BADGE_NUMBER_ERROR, isValidBadgeNumber, sanitizeBadgeNumber } from '../utils/badgeNumber';

function defaultForm(currentAdmin: AdminUser): CreateOfficerInput {
  return {
    badgeNumber: '',
    fullName: '',
    department: currentAdmin.role === 'REGIONAL_ADMIN' ? currentAdmin.department || '' : DEPARTMENTS[0],
    unit: currentAdmin.role === 'REGIONAL_ADMIN' ? currentAdmin.unit || '' : '',
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
      item.createdAt ? new Date(item.createdAt).toLocaleString('uk-UA') : '',
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'officers-export.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function OfficerDirectory({ currentAdmin }: { currentAdmin: AdminUser }) {
  const isRegional = currentAdmin.role === 'REGIONAL_ADMIN';
  const [officers, setOfficers] = useState<Officer[]>([]);
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

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await getOfficers(isRegional ? { department: currentAdmin.department || '' } : {});
      setOfficers(Array.isArray(result) ? result : []);
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

  function showForm(officer?: Officer) {
    setEditing(officer);
    setError('');
    setSuccess('');
    setForm(officer ? {
      badgeNumber: officer.badgeNumber,
      fullName: officer.fullName,
      department: isRegional ? currentAdmin.department || officer.department : officer.department,
      unit: officer.unit || '',
      pin: '',
      isActive: officer.isActive !== false,
    } : defaultForm(currentAdmin));
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const normalizedForm = {
      ...form,
      department: isRegional ? currentAdmin.department || '' : form.department,
      unit: form.unit?.trim() || null,
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

  async function deactivate(item: Officer) {
    if (!item.id || !window.confirm(`Деактивувати патрульного ${item.fullName}?`)) return;
    try {
      await deactivateOfficer(item.id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося деактивувати патрульного.');
    }
  }

  return <section className="directory-panel">
    <div className="directory-toolbar">
      <div><span className="eyebrow">Довідник</span><h2>Користувачі</h2></div>
      <div className="admin-actions">
        <button onClick={() => showForm()}>Додати патрульного</button>
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

    {loading ? <div className="empty-state compact-empty">Завантаження…</div> : !officers.length ? <div className="empty-state compact-empty"><p>Користувачів ще не додано.</p></div> : !filtered.length ? <div className="empty-state compact-empty"><p>Користувачів за вибраними фільтрами не знайдено.</p></div> : <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Жетон</th><th>ПІБ</th><th>УПП</th><th>Підрозділ</th><th>Активний</th><th>PIN встановлено</th><th>Дата створення</th><th>Дії</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id ?? item.badgeNumber}><td>{item.badgeNumber}</td><td>{item.fullName}</td><td>{item.department}</td><td>{item.unit || '—'}</td><td><span className={`status ${item.isActive === false ? 'needs_review' : 'completed'}`}>{item.isActive === false ? 'Ні' : 'Так'}</span></td><td>{item.hasPin ? 'Так' : 'Ні'}</td><td>{item.createdAt ? new Date(item.createdAt).toLocaleString('uk-UA') : '—'}</td><td className="row-actions"><button className="small-button" onClick={() => showForm(item)}>Редагувати</button>{item.isActive !== false && <button className="small-button danger-outline" onClick={() => void deactivate(item)}>Деактивувати</button>}</td></tr>)}</tbody></table></div></div>}

    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal directory-modal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading"><h2>{editing ? 'Редагування патрульного' : 'Новий патрульний'}</h2><button type="button" className="text-button" onClick={() => setOpen(false)}>Закрити</button></div>
      <datalist id="department-options">{DEPARTMENTS.map((item) => <option key={item} value={item} />)}</datalist>
      <div className="form-grid">
        <label>Номер жетона<input value={form.badgeNumber} onChange={(event) => setForm({ ...form, badgeNumber: sanitizeBadgeNumber(event.target.value) })} onPaste={(event) => { event.preventDefault(); setForm({ ...form, badgeNumber: sanitizeBadgeNumber(event.clipboardData.getData('text')) }); }} inputMode="numeric" maxLength={7} placeholder="0000001" required /></label>
        <label>{editing ? 'Новий PIN' : 'PIN'}<input type="password" value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value.replace(/\D/g, '').slice(0, 8) })} inputMode="numeric" minLength={4} maxLength={8} placeholder={editing ? 'Залиште порожнім без змін' : '4–8 цифр'} required={!editing} /><small>{editing ? 'Необов’язково. Поточний PIN не показується.' : 'Від 4 до 8 цифр.'}</small></label>
        <label>ПІБ<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required /></label>
        <label>УПП<input value={isRegional ? currentAdmin.department || '' : form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} list="department-options" readOnly={isRegional} required /></label>
        <label>Підрозділ<input value={form.unit || ''} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="Необов’язково" /></label>
        <label className="checkbox-filter"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Активний</label>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="submit">Зберегти</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Скасувати</button></div>
    </form></div>}
  </section>;
}
