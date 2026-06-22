import { useEffect, useMemo, useState } from 'react';
import { createOfficer, deactivateOfficer, getOfficers, PIN_ERROR, updateOfficer } from '../services/officerService';
import type { CreateOfficerInput, Officer } from '../types';
import { BADGE_NUMBER_ERROR, isValidBadgeNumber, sanitizeBadgeNumber } from '../utils/badgeNumber';

const emptyForm: CreateOfficerInput = { badgeNumber: '', fullName: '', department: 'УПП у Волинській області', pin: '', isActive: true, isPilotAllowed: false };

function downloadCsv(officers: Officer[]) {
  const rows = [['Номер жетона', 'ПІБ', 'УПП', 'Статус', 'Пілотний доступ', 'PIN встановлено', 'Дата створення'], ...officers.map((item) => [item.badgeNumber, item.fullName, item.department, item.isActive === false ? 'Неактивний' : 'Активний', item.isPilotAllowed ? 'Так' : 'Ні', item.hasPin ? 'Так' : 'Ні', item.createdAt ? new Date(item.createdAt).toLocaleString('uk-UA') : ''])];
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'officers-export.csv'; link.click(); URL.revokeObjectURL(url);
}

export function OfficerDirectory() {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('all');
  const [pilot, setPilot] = useState('all');
  const [editing, setEditing] = useState<Officer>();
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError('');
    try {
      const result = await getOfficers();
      setOfficers(Array.isArray(result) ? result : []);
    } catch (caught) {
      console.error('[OfficerDirectory] load failed', caught);
      setOfficers([]);
      setError('Не вдалося завантажити дані. Перевірте з’єднання з сервером.');
    }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => officers.filter((item) => {
    const query = search.trim().toLocaleLowerCase('uk-UA');
    return (!query || `${item.fullName} ${item.badgeNumber} ${item.department}`.toLocaleLowerCase('uk-UA').includes(query))
      && (!department.trim() || item.department.toLocaleLowerCase('uk-UA').includes(department.trim().toLocaleLowerCase('uk-UA')))
      && (status === 'all' || Boolean(item.isActive !== false) === (status === 'active'))
      && (pilot === 'all' || Boolean(item.isPilotAllowed) === (pilot === 'yes'));
  }), [department, officers, pilot, search, status]);

  function showForm(officer?: Officer) {
    setEditing(officer); setError(''); setSuccess('');
    setForm(officer ? { badgeNumber: officer.badgeNumber, fullName: officer.fullName, department: officer.department, pin: '', isActive: officer.isActive !== false, isPilotAllowed: Boolean(officer.isPilotAllowed) } : emptyForm);
    setOpen(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!isValidBadgeNumber(form.badgeNumber)) { setError(BADGE_NUMBER_ERROR); return; }
    if ((!editing && !/^\d{4,8}$/.test(form.pin)) || (editing && form.pin && !/^\d{4,8}$/.test(form.pin))) { setError(PIN_ERROR); return; }
    if (!form.fullName.trim() || !form.department.trim()) { setError('Заповніть ПІБ та УПП.'); return; }
    try {
      const isEditing = Boolean(editing?.id);
      if (editing?.id) await updateOfficer(editing.id, form); else await createOfficer(form);
      setOpen(false); await load(); setSuccess(isEditing ? 'Дані патрульного оновлено.' : 'Патрульного додано.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Не вдалося зберегти патрульного.'); }
  }
  async function deactivate(item: Officer) {
    if (!item.id || !window.confirm(`Деактивувати патрульного ${item.fullName}?`)) return;
    try { await deactivateOfficer(item.id); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Не вдалося деактивувати патрульного.'); }
  }

  return <section className="directory-panel">
    <div className="directory-toolbar"><div><span className="eyebrow">Довідник</span><h2>Користувачі</h2></div><div className="admin-actions"><button onClick={() => showForm()}>Додати патрульного</button><button className="secondary compact" onClick={() => void load()}>Оновити</button><button className="secondary compact" onClick={() => downloadCsv(filtered)} disabled={!filtered.length}>Експорт CSV</button></div></div>
    <div className="directory-filters"><label>Пошук<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ПІБ або жетон" /></label><label>УПП<input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Фільтр за УПП" /></label><label>Статус<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Всі</option><option value="active">Активні</option><option value="inactive">Неактивні</option></select></label><label>Пілотний доступ<select value={pilot} onChange={(e) => setPilot(e.target.value)}><option value="all">Всі</option><option value="yes">Дозволено</option><option value="no">Не дозволено</option></select></label></div>
    {error && <p className="message error" role="alert">{error}</p>}
    {success && <p className="message success" role="status">{success}</p>}
    {loading ? <div className="empty-state compact-empty">Завантаження…</div> : !officers.length ? <div className="empty-state compact-empty"><p>Користувачів ще не додано.</p></div> : !filtered.length ? <div className="empty-state compact-empty"><p>Користувачів за вибраними фільтрами не знайдено.</p></div> : <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Жетон</th><th>ПІБ</th><th>УПП</th><th>Активний</th><th>Доступ до пілоту</th><th>PIN встановлено</th><th>Дата створення</th><th>Дії</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id ?? item.badgeNumber}><td>{item.badgeNumber}</td><td>{item.fullName}</td><td>{item.department}</td><td><span className={`status ${item.isActive === false ? 'needs_review' : 'completed'}`}>{item.isActive === false ? 'Ні' : 'Так'}</span></td><td>{item.isPilotAllowed ? 'Так' : 'Ні'}</td><td>{item.hasPin ? 'Так' : 'Ні'}</td><td>{item.createdAt ? new Date(item.createdAt).toLocaleString('uk-UA') : '—'}</td><td className="row-actions"><button className="small-button" onClick={() => showForm(item)}>Редагувати</button>{item.isActive !== false && <button className="small-button danger-outline" onClick={() => void deactivate(item)}>Деактивувати</button>}</td></tr>)}</tbody></table></div></div>}
    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal directory-modal" onSubmit={save} onMouseDown={(e) => e.stopPropagation()}><div className="section-heading"><h2>{editing ? 'Редагування патрульного' : 'Новий патрульний'}</h2><button type="button" className="text-button" onClick={() => setOpen(false)}>Закрити</button></div><div className="form-grid"><label>Номер жетона<input value={form.badgeNumber} onChange={(e) => setForm({ ...form, badgeNumber: sanitizeBadgeNumber(e.target.value) })} onPaste={(e) => { e.preventDefault(); setForm({ ...form, badgeNumber: sanitizeBadgeNumber(e.clipboardData.getData('text')) }); }} inputMode="numeric" maxLength={7} placeholder="0000001" required /></label><label>{editing ? 'Новий PIN' : 'PIN'}<input type="password" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 8) })} inputMode="numeric" minLength={4} maxLength={8} placeholder={editing ? 'Залиште порожнім без змін' : '4–8 цифр'} required={!editing} /><small>{editing ? 'Необов’язково. Поточний PIN не показується.' : 'Від 4 до 8 цифр.'}</small></label><label>ПІБ<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></label><label>УПП<input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required /></label><label className="checkbox-filter"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Активний</label><label className="checkbox-filter"><input type="checkbox" checked={form.isPilotAllowed} onChange={(e) => setForm({ ...form, isPilotAllowed: e.target.checked })} />Доступ до пілоту</label></div>{error && <p className="message error" role="alert">{error}</p>}<div className="modal-actions"><button type="submit">Зберегти</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Скасувати</button></div></form></div>}
  </section>;
}
