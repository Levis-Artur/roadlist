import { useEffect, useMemo, useState } from 'react';
import { createDepartment, getDepartments, updateDepartment } from '../services/organizationService';
import type { AdminUser, Department } from '../types';

const emptyForm = { name: '', code: '', region: '', isActive: true };

export function DepartmentDirectory({ currentAdmin }: { currentAdmin: AdminUser }) {
  const canEdit = currentAdmin.role === 'SYSTEM_OWNER' || currentAdmin.role === 'NATIONAL_ADMIN';
  const [items, setItems] = useState<Department[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Department | null>(null);
  const [selected, setSelected] = useState<Department | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try { setItems(await getDepartments()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Не вдалося завантажити управління.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('uk-UA');
    return items.filter((item) => !normalized || `${item.name} ${item.code || ''} ${item.region || ''}`.toLocaleLowerCase('uk-UA').includes(normalized));
  }, [items, query]);

  function showForm(item?: Department) {
    setEditing(item ?? null);
    setForm(item ? { name: item.name, code: item.code || '', region: item.region || '', isActive: item.isActive } : emptyForm);
    setError('');
    setOpen(true);
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
        <td className="row-actions"><button className="small-button" onClick={() => setSelected(item)}>Переглянути</button>{canEdit && <button className="small-button" onClick={() => showForm(item)}>Редагувати</button>}</td>
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

    {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}><section className="modal detail-modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading"><div><span className="eyebrow">Управління</span><h2>{selected.name}</h2></div><button type="button" className="text-button" onClick={() => setSelected(null)}>Закрити</button></div>
      <dl className="detail-grid">
        <div><dt>Код</dt><dd>{selected.code || '—'}</dd></div>
        <div><dt>Регіон</dt><dd>{selected.region || '—'}</dd></div>
        <div><dt>Статус</dt><dd>{selected.isActive ? 'Активне' : 'Неактивне'}</dd></div>
        <div><dt>Підрозділів</dt><dd>{selected.unitCount ?? 0}</dd></div>
        <div><dt>Автомобілів</dt><dd>{selected.vehicleCount ?? 0}</dd></div>
        <div><dt>Поліцейських</dt><dd>{selected.officerCount ?? 0}</dd></div>
        <div><dt>Маршрутних листів</dt><dd>{selected.routeSheetCount ?? 0}</dd></div>
      </dl>
    </section></div>}
  </section>;
}
