import { useEffect, useMemo, useState } from 'react';
import type { AdminRole, AdminUser } from '../types';
import { adminRoleLabels, createAdminUser, deactivateAdminUser, getAdminUsers, updateAdminUser } from '../services/adminService';

const emptyForm = { username: '', fullName: '', role: 'REGIONAL_ADMIN' as AdminRole, department: '', password: '', isActive: true };

export function AdminUsersDirectory({ currentAdmin }: { currentAdmin: AdminUser }) {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const availableRoles = useMemo<AdminRole[]>(() => (
    currentAdmin.role === 'SYSTEM_OWNER' ? ['NATIONAL_ADMIN', 'REGIONAL_ADMIN'] : ['REGIONAL_ADMIN']
  ), [currentAdmin.role]);

  async function load() {
    try { setItems(await getAdminUsers()); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Не вдалося завантажити адміністраторів.'); }
  }

  useEffect(() => { void load(); }, []);

  function showForm(item?: AdminUser) {
    setEditing(item ?? null);
    setForm(item
      ? { username: item.username, fullName: item.fullName, role: item.role, department: item.department ?? '', password: '', isActive: item.isActive }
      : { ...emptyForm, role: availableRoles[0] });
    setOpen(true);
    setError('');
    setSuccess('');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (form.role === 'REGIONAL_ADMIN' && !form.department.trim()) {
      setError('УПП обов’язкове для регіонального адміністратора.');
      return;
    }
    if (!editing && !form.password.trim()) {
      setError('Пароль обов’язковий для нового адміністратора.');
      return;
    }
    try {
      const payload = {
        username: form.username.trim(),
        fullName: form.fullName.trim(),
        role: form.role,
        department: form.role === 'REGIONAL_ADMIN' ? form.department.trim() : null,
        password: form.password.trim() || undefined,
        isActive: form.isActive,
      };
      if (editing) await updateAdminUser(editing.id, payload);
      else await createAdminUser({ ...payload, password: form.password.trim() });
      setSuccess(editing ? 'Адміністратора оновлено.' : 'Адміністратора створено.');
      setOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося зберегти адміністратора.');
    }
  }

  async function deactivate(item: AdminUser) {
    if (!window.confirm(`Деактивувати адміністратора ${item.username}?`)) return;
    try {
      await deactivateAdminUser(item.id);
      setSuccess('Адміністратора деактивовано.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося деактивувати адміністратора.');
    }
  }

  return (
    <section className="directory-panel">
      <div className="directory-toolbar">
        <div><span className="eyebrow">Доступ</span><h2>Адміністратори</h2></div>
        <div className="admin-actions"><button onClick={() => showForm()}>Додати адміністратора</button><button className="secondary compact" onClick={() => void load()}>Оновити</button></div>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}
      {success && <p className="message success" role="status">{success}</p>}
      <div className="table-card"><div className="table-scroll"><table>
        <thead><tr><th>Логін</th><th>ПІБ</th><th>Роль</th><th>УПП</th><th>Активний</th><th>Створено</th><th>Дії</th></tr></thead>
        <tbody>{items.map((item) => {
          const protectedOwner = item.role === 'SYSTEM_OWNER';
          return (
            <tr key={item.id}>
              <td>{item.username}</td><td>{item.fullName}</td><td>{adminRoleLabels[item.role]}</td><td>{item.department || '—'}</td>
              <td><span className={`status ${item.isActive ? 'completed' : 'needs_review'}`}>{item.isActive ? 'Так' : 'Ні'}</span></td>
              <td>{item.createdAt ? new Date(item.createdAt).toLocaleString('uk-UA') : '—'}</td>
              <td className="row-actions">
                {!protectedOwner && <button className="small-button" onClick={() => showForm(item)}>Редагувати</button>}
                {!protectedOwner && item.isActive && <button className="small-button danger-outline" onClick={() => void deactivate(item)}>Деактивувати</button>}
                {protectedOwner && <span className="meta-badge">Захищено</span>}
              </td>
            </tr>
          );
        })}</tbody>
      </table></div></div>
      {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal directory-modal" onSubmit={save} onMouseDown={(e) => e.stopPropagation()}>
        <div className="section-heading"><h2>{editing ? 'Редагування адміністратора' : 'Новий адміністратор'}</h2><button type="button" className="text-button" onClick={() => setOpen(false)}>Закрити</button></div>
        <div className="form-grid">
          <label>Логін<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></label>
          <label>ПІБ<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></label>
          <label>Роль<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}>{availableRoles.map((role) => <option key={role} value={role}>{adminRoleLabels[role]}</option>)}</select></label>
          {form.role === 'REGIONAL_ADMIN' && <label>УПП<input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required /></label>}
          <label>{editing ? 'Новий пароль' : 'Пароль'}<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} /><small>{editing ? 'Залиште порожнім, якщо пароль не змінюється.' : 'Тимчасовий пароль для входу.'}</small></label>
          <label className="checkbox-filter"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Активний</label>
        </div>
        {error && <p className="message error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="submit">Зберегти</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Скасувати</button></div>
      </form></div>}
    </section>
  );
}
