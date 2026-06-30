import { useEffect, useMemo, useState } from 'react';
import type { AdminRole, AdminUser, Department } from '../types';
import { adminRoleLabels, canDeleteRecords, createAdminUser, deactivateAdminUser, getAdminUsers, recoverAdminAccess, updateAdminUser } from '../services/adminService';
import { getDepartments } from '../services/organizationService';
import { DeleteConfirmModal } from './DeleteConfirmModal';

const emptyForm = { username: '', fullName: '', role: 'REGIONAL_ADMIN' as AdminRole, departmentId: '', department: '', unit: '', password: '', isActive: true };
const emptyRecoveryForm = { resetPassword: true, resetTwoFactor: true };

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('uk-UA') : '—';
}

function isLocked(item: AdminUser) {
  return item.lockedUntil ? new Date(item.lockedUntil) > new Date() : false;
}

export function AdminUsersDirectory({ currentAdmin }: { currentAdmin: AdminUser }) {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [recoveryTarget, setRecoveryTarget] = useState<AdminUser | null>(null);
  const [recoveryForm, setRecoveryForm] = useState(emptyRecoveryForm);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryResult, setRecoveryResult] = useState<{ temporaryPassword?: string; resetPassword: boolean; resetTwoFactor: boolean } | null>(null);
  const [copySuccess, setCopySuccess] = useState('');
  const canDelete = canDeleteRecords(currentAdmin);
  const availableRoles = useMemo<AdminRole[]>(() => (
    currentAdmin.role === 'SYSTEM_OWNER' ? ['NATIONAL_ADMIN', 'REGIONAL_ADMIN'] : ['REGIONAL_ADMIN']
  ), [currentAdmin.role]);

  async function load() {
    try { setItems(await getAdminUsers()); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Не вдалося завантажити адміністраторів.'); }
  }

  useEffect(() => { void load(); void getDepartments().then(setDepartments).catch(() => undefined); }, []);

  function showForm(item?: AdminUser) {
    setEditing(item ?? null);
    setForm(item
      ? { username: item.username, fullName: item.fullName, role: item.role, departmentId: item.departmentId ?? '', department: item.departmentName ?? item.department ?? '', unit: item.unit ?? '', password: '', isActive: item.isActive }
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
        departmentId: form.role === 'REGIONAL_ADMIN' ? form.departmentId || null : null,
        department: form.role === 'REGIONAL_ADMIN' ? form.department.trim() : null,
        departmentName: form.role === 'REGIONAL_ADMIN' ? form.department.trim() : null,
        unit: form.role === 'REGIONAL_ADMIN' ? form.unit.trim() || null : null,
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

  async function deactivate(item: AdminUser, input: { reason: string; confirmText: string }) {
    try {
      await deactivateAdminUser(item.id, input);
      setSuccess('Адміністратора видалено.');
      setDeleteTarget(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося видалити адміністратора.');
    }
  }

  function openRecovery(item: AdminUser) {
    setRecoveryTarget(item);
    setRecoveryForm(emptyRecoveryForm);
    setRecoveryError('');
    setRecoveryResult(null);
    setCopySuccess('');
    setError('');
    setSuccess('');
  }

  function closeRecovery() {
    setRecoveryTarget(null);
    setRecoveryForm(emptyRecoveryForm);
    setRecoveryError('');
    setRecoveryResult(null);
    setCopySuccess('');
  }

  async function submitRecovery(event: React.FormEvent) {
    event.preventDefault();
    if (!recoveryTarget) return;
    if (!recoveryForm.resetPassword && !recoveryForm.resetTwoFactor) {
      setRecoveryError('Оберіть дію для відновлення доступу.');
      return;
    }
    try {
      const result = await recoverAdminAccess(recoveryTarget.id, recoveryForm);
      setRecoveryResult({ temporaryPassword: result.temporaryPassword, ...recoveryForm });
      setRecoveryError('');
      setSuccess([
        recoveryForm.resetPassword ? 'Пароль адміністратора скинуто.' : '',
        recoveryForm.resetTwoFactor ? '2FA адміністратора скинуто.' : '',
      ].filter(Boolean).join(' '));
      await load();
    } catch (caught) {
      setRecoveryError(caught instanceof Error ? caught.message : 'Не вдалося відновити доступ адміністратора.');
    }
  }

  async function copyTemporaryPassword() {
    if (!recoveryResult?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(recoveryResult.temporaryPassword);
      setCopySuccess('Пароль скопійовано.');
    } catch {
      setCopySuccess('Не вдалося скопіювати автоматично.');
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
      <div className="table-card"><div className="table-scroll"><table className="responsive-table admin-users-table">
        <thead><tr><th>Логін</th><th>ПІБ</th><th>Роль</th><th>УПП</th><th>Підрозділ</th><th>Активний</th><th>2FA</th><th>Останній вхід</th><th>Зміна пароля</th><th>Тимчасовий пароль</th><th>Заблоковано до</th><th>Дії</th></tr></thead>
        <tbody>{items.map((item) => {
          const protectedOwner = item.role === 'SYSTEM_OWNER';
          return (
            <tr key={item.id}>
              <td>{item.username}</td><td>{item.fullName}</td><td>{adminRoleLabels[item.role]}</td><td>{item.department || '—'}</td><td>{item.unit || '—'}</td>
              <td><span className={`status ${item.isActive ? 'completed' : 'needs_review'}`}>{item.isActive ? 'Так' : 'Ні'}</span></td>
              <td>{item.twoFactorEnabled ? <span className="meta-badge">Увімкнена</span> : <span className="meta-badge warning">Не увімкнена</span>}</td>
              <td>{formatDate(item.lastLoginAt)}</td>
              <td>{formatDate(item.passwordChangedAt)}</td>
              <td>{item.mustChangePassword ? <span className="meta-badge warning">Потрібна зміна пароля</span> : '—'}</td>
              <td>{isLocked(item) ? <span className="meta-badge warning">{formatDate(item.lockedUntil)}</span> : '—'}</td>
              <td className="row-actions">
                {!protectedOwner && <button className="small-button" onClick={() => showForm(item)}>Редагувати</button>}
                {canDelete && !protectedOwner && currentAdmin.id !== item.id && item.isActive && <button className="small-button danger-outline" onClick={() => setDeleteTarget(item)}>Видалити</button>}
                {currentAdmin.role === 'SYSTEM_OWNER' && !protectedOwner && currentAdmin.id !== item.id && <button className="small-button danger-outline" onClick={() => openRecovery(item)}>Відновити доступ</button>}
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
          {form.role === 'REGIONAL_ADMIN' && <label>Управління<select value={form.departmentId} onChange={(e) => { const selected = departments.find((item) => item.id === e.target.value); setForm({ ...form, departmentId: e.target.value, department: selected?.name || '' }); }} required><option value="">Оберіть управління</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          {form.role === 'REGIONAL_ADMIN' && <label>Підрозділ<input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Необов’язково" /></label>}
          {!editing && <label>Тимчасовий пароль<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /><small>Це тимчасовий пароль. Після першого входу адміністратор повинен змінити його.</small></label>}
          <label className="checkbox-filter"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Активний</label>
        </div>
        {error && <p className="message error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="submit">Зберегти</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Скасувати</button></div>
      </form></div>}
      {recoveryTarget && <div className="modal-backdrop" onMouseDown={closeRecovery}><form className="modal directory-modal recovery-modal" onSubmit={submitRecovery} onMouseDown={(e) => e.stopPropagation()}>
        <div className="section-heading"><div><span className="eyebrow">Доступ</span><h2>Відновити доступ адміністратора</h2></div><button type="button" className="text-button" onClick={closeRecovery}>Закрити</button></div>
        <dl className="detail-grid compact-detail-grid">
          <div><dt>Логін</dt><dd>{recoveryTarget.username}</dd></div>
          <div><dt>ПІБ</dt><dd>{recoveryTarget.fullName}</dd></div>
          <div><dt>Роль</dt><dd>{adminRoleLabels[recoveryTarget.role]}</dd></div>
        </dl>
        {!recoveryResult ? <>
          <p className="message warning" role="status">Ця дія не показує старий пароль і не відкриває попередній секретний ключ 2FA. Новий тимчасовий пароль генерується сервером і буде показаний лише один раз.</p>
          <div className="recovery-options">
            <label className="checkbox-filter"><input type="checkbox" checked={recoveryForm.resetPassword} onChange={(e) => setRecoveryForm({ ...recoveryForm, resetPassword: e.target.checked })} />Скинути пароль</label>
            <label className="checkbox-filter"><input type="checkbox" checked={recoveryForm.resetTwoFactor} onChange={(e) => setRecoveryForm({ ...recoveryForm, resetTwoFactor: e.target.checked })} />Скинути 2FA</label>
          </div>
          {recoveryError && <p className="message error" role="alert">{recoveryError}</p>}
          <div className="modal-actions"><button type="submit" className="danger">Відновити доступ</button><button type="button" className="secondary" onClick={closeRecovery}>Скасувати</button></div>
        </> : <>
          <div className="message success" role="status">
            {recoveryResult.resetPassword && <p>Пароль адміністратора скинуто.</p>}
            {recoveryResult.resetTwoFactor && <p>2FA адміністратора скинуто.</p>}
            {recoveryResult.resetPassword && <p>Адміністратор має встановити новий пароль після входу.</p>}
            {recoveryResult.resetTwoFactor && <p>Адміністратор має заново налаштувати автентифікатор після входу.</p>}
          </div>
          {recoveryResult.temporaryPassword && <div className="temporary-password-panel">
            <span className="eyebrow">Тимчасовий пароль</span>
            <code>{recoveryResult.temporaryPassword}</code>
            <p className="message warning">Скопіюйте тимчасовий пароль зараз. Після закриття цього вікна він більше не буде показаний.</p>
            <button type="button" className="secondary" onClick={() => void copyTemporaryPassword()}>Скопіювати пароль</button>
            {copySuccess && <p className="field-hint">{copySuccess}</p>}
          </div>}
          <div className="modal-actions"><button type="button" onClick={closeRecovery}>Закрити</button></div>
        </>}
      </form></div>}
      {deleteTarget && <DeleteConfirmModal title="Видалити адміністратора" description={`Буде приховано адміністратора: ${deleteTarget.username}.`} onCancel={() => setDeleteTarget(null)} onConfirm={(input) => deactivate(deleteTarget, input)} />}
    </section>
  );
}
