import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { AdminUser } from '../../types';
import { formatDate } from '../../utils/format';
import { adminRoleLabels } from '../../utils/roles';
import { DetailItem } from './AdminDetail';

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface AdminProfileSectionProps {
  myProfile: AdminUser;
  profilePasswordForm: PasswordForm;
  profileMessage: string;
  setProfilePasswordForm: Dispatch<SetStateAction<PasswordForm>>;
  onSubmitPassword: (event: FormEvent) => void | Promise<void>;
}

export function AdminProfileSection({
  myProfile,
  profilePasswordForm,
  profileMessage,
  setProfilePasswordForm,
  onSubmitPassword,
}: AdminProfileSectionProps) {
  return (
    <section className="panel">
      <div className="section-heading"><div><span className="eyebrow">Безпека</span><h2>Мій профіль</h2></div></div>
      <dl className="detail-grid">
        <DetailItem label="ПІБ" value={myProfile.fullName} />
        <DetailItem label="Логін" value={myProfile.username} />
        <DetailItem label="Роль" value={adminRoleLabels[myProfile.role]} />
        <DetailItem label="УПП" value={myProfile.department || '—'} />
        <DetailItem label="Підрозділ" value={myProfile.unit || '—'} />
        <DetailItem label="Останній вхід" value={formatDate(myProfile.lastLoginAt)} />
        <DetailItem label="Дата зміни пароля" value={formatDate(myProfile.passwordChangedAt)} />
        <DetailItem label="Двофакторна автентифікація" value={myProfile.twoFactorEnabled ? 'Увімкнена' : 'Не увімкнена'} />
        <DetailItem label="2FA увімкнено" value={formatDate(myProfile.twoFactorEnabledAt)} />
      </dl>
      <form className="admin-review-form" onSubmit={(event) => void onSubmitPassword(event)}>
        <h3>Змінити пароль</h3>
        <div className="form-grid">
          <label>Поточний пароль<input type="password" value={profilePasswordForm.currentPassword} onChange={(event) => setProfilePasswordForm({ ...profilePasswordForm, currentPassword: event.target.value })} required /></label>
          <label>Новий пароль<input type="password" value={profilePasswordForm.newPassword} onChange={(event) => setProfilePasswordForm({ ...profilePasswordForm, newPassword: event.target.value })} required /><small>Мінімум 12 символів: велика і мала літера, цифра та спецсимвол.</small></label>
          <label>Повторити новий пароль<input type="password" value={profilePasswordForm.confirmPassword} onChange={(event) => setProfilePasswordForm({ ...profilePasswordForm, confirmPassword: event.target.value })} required /></label>
        </div>
        <button type="submit">Зберегти новий пароль</button>
        {profileMessage && <p className="message success" role="status">{profileMessage}</p>}
      </form>
    </section>
  );
}
