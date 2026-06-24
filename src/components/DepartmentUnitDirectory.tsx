import { useEffect, useMemo, useState } from 'react';
import { createDepartmentUnit, getDepartments, getDepartmentUnits, updateDepartmentUnit } from '../services/organizationService';
import type { AdminUser, Department, DepartmentUnit } from '../types';

const unitTypes = ['Апарат', 'Служба', 'Патрульний підрозділ', 'Спецпідрозділ', 'Інше'];
const emptyForm = { departmentId: '', name: '', type: '', code: '', description: '', isActive: true };

export function DepartmentUnitDirectory({ currentAdmin }: { currentAdmin: AdminUser }) {
  const isRegional = currentAdmin.role === 'REGIONAL_ADMIN';
  const [departments, setDepartments] = useState<Department[]>([]);
  const [items, setItems] = useState<DepartmentUnit[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<DepartmentUnit | null>(null);
  const [selected, setSelected] = useState<DepartmentUnit | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [departmentItems, unitItems] = await Promise.all([getDepartments(), getDepartmentUnits()]);
      setDepartments(departmentItems);
      setItems(unitItems);
      if (isRegional && currentAdmin.departmentId) setDepartmentFilter(currentAdmin.departmentId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося завантажити внутрішні підрозділи.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('uk-UA');
    return items.filter((item) => (!departmentFilter || item.departmentId === departmentFilter)
      && (!normalized || `${item.name} ${item.type || ''} ${item.code || ''} ${item.department?.name || ''}`.toLocaleLowerCase('uk-UA').includes(normalized)));
  }, [departmentFilter, items, query]);

  function showForm(item?: DepartmentUnit) {
    setEditing(item ?? null);
    const departmentId = isRegional ? currentAdmin.departmentId || departments[0]?.id || '' : item?.departmentId || departmentFilter || departments[0]?.id || '';
    setForm(item ? {
      departmentId,
      name: item.name,
      type: item.type || '',
      code: item.code || '',
      description: item.description || '',
      isActive: item.isActive,
    } : { ...emptyForm, departmentId });
    setError('');
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.departmentId || !form.name.trim()) {
      setError('Оберіть управління і вкажіть назву підрозділу.');
      return;
    }
    try {
      const payload = {
        departmentId: isRegional ? currentAdmin.departmentId || form.departmentId : form.departmentId,
        name: form.name.trim(),
        type: form.type.trim() || null,
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        isActive: form.isActive,
      };
      if (editing) await updateDepartmentUnit(editing.id, payload);
      else await createDepartmentUnit(payload);
      setOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося зберегти внутрішній підрозділ.');
    }
  }

  return <section className="directory-panel">
    <div className="directory-toolbar">
      <div><span className="eyebrow">Оргструктура</span><h2>Внутрішні підрозділи</h2></div>
      <div className="admin-actions"><button onClick={() => showForm()}>Додати підрозділ</button><button className="secondary compact" onClick={() => void load()}>Оновити</button></div>
    </div>
    <div className="directory-filters">
      {!isRegional && <label>Управління<select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="">Всі</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {isRegional && <label>Управління<input value={currentAdmin.departmentName || currentAdmin.department || '—'} readOnly /></label>}
      <label>Пошук<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Назва, тип або код" /></label>
    </div>
    {error && <p className="message error" role="alert">{error}</p>}
    {loading ? <div className="empty-state compact-empty">Завантаження…</div> : <div className="table-card"><div className="table-scroll"><table>
      <thead><tr><th>Управління</th><th>Внутрішній підрозділ</th><th>Тип</th><th>Код</th><th>Активний</th><th>Дії</th></tr></thead>
      <tbody>{filtered.map((item) => <tr key={item.id}><td>{item.department?.name || '—'}</td><td>{item.name}</td><td>{item.type || '—'}</td><td>{item.code || '—'}</td><td><span className={`status ${item.isActive ? 'completed' : 'needs_review'}`}>{item.isActive ? 'Так' : 'Ні'}</span></td><td className="row-actions"><button className="small-button" onClick={() => setSelected(item)}>Переглянути</button><button className="small-button" onClick={() => showForm(item)}>Редагувати</button></td></tr>)}</tbody>
    </table></div></div>}

    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal directory-modal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading"><h2>{editing ? 'Редагування підрозділу' : 'Новий внутрішній підрозділ'}</h2><button type="button" className="text-button" onClick={() => setOpen(false)}>Закрити</button></div>
      <div className="form-grid">
        <label>Управління<select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} disabled={isRegional} required>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Назва підрозділу<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label>Тип<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="">Не вказано</option>{unitTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Код<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
        <label>Опис<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <label className="checkbox-filter"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Активний</label>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="submit">Зберегти</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Скасувати</button></div>
    </form></div>}

    {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}><section className="modal detail-modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="section-heading"><div><span className="eyebrow">Внутрішній підрозділ</span><h2>{selected.name}</h2></div><button type="button" className="text-button" onClick={() => setSelected(null)}>Закрити</button></div>
      <dl className="detail-grid">
        <div><dt>Управління</dt><dd>{selected.department?.name || '—'}</dd></div>
        <div><dt>Тип</dt><dd>{selected.type || '—'}</dd></div>
        <div><dt>Код</dt><dd>{selected.code || '—'}</dd></div>
        <div><dt>Статус</dt><dd>{selected.isActive ? 'Активний' : 'Неактивний'}</dd></div>
        <div><dt>Опис</dt><dd>{selected.description || '—'}</dd></div>
      </dl>
    </section></div>}
  </section>;
}
