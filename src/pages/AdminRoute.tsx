import { useEffect, useState } from 'react';
import { changeOwnPassword, enableTwoFactor, getCurrentAdmin, getMyAdminProfile, isAdminAuthenticated, loginAdmin, logoutAdmin, setupTwoFactor, verifyTwoFactor } from '../services/adminService';
import { AdminPage } from './AdminPage';
import type { AdminUser } from '../types';

type AdminAuthPhase = 'login' | 'change_password' | 'setup_2fa' | 'verify_2fa';

function PasswordChangeForm({ forced, onChanged, onCancel }: { forced?: boolean; onChanged: () => void; onCancel: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await changeOwnPassword({ currentPassword, newPassword, confirmPassword });
      setError('');
      setSuccess('Пароль змінено. Увійдіть повторно з новим паролем.');
      window.setTimeout(onChanged, 700);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося змінити пароль.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="login-titlebar">Зміна пароля адміністратора</div>
        {forced && <p className="message warning" role="status">Ви увійшли з тимчасовим паролем. Перед початком роботи потрібно встановити власний надійний пароль.</p>}
        <form onSubmit={submit}>
          <label>Поточний пароль<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label>
          <label>Новий пароль<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required /><small>Мінімум 12 символів: велика і мала літера, цифра та спецсимвол.</small></label>
          <label>Повторити новий пароль<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required /></label>
          <button type="submit" disabled={submitting}>{submitting ? 'Збереження…' : 'Змінити пароль'}</button>
        </form>
        {!forced && <button type="button" className="secondary compact" onClick={onCancel}>Скасувати</button>}
        {success && <p className="message success" role="status">{success}</p>}
        {error && <p className="message error" role="alert">{error}</p>}
      </section>
    </main>
  );
}

function TwoFactorCodeForm({ setup, onVerified }: { setup?: boolean; onVerified: (admin: AdminUser) => void }) {
  const [setupData, setSetupData] = useState<{ qrCodeDataUrl: string; manualEntryKey: string; issuer: string; accountName: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (setup) setupTwoFactor().then(setSetupData).catch((caught) => setError(caught instanceof Error ? caught.message : 'Не вдалося почати налаштування 2FA.'));
  }, [setup]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const admin = setup ? await enableTwoFactor(code) : await verifyTwoFactor(code);
      onVerified(admin);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Невірний код автентифікатора');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="login-titlebar">{setup ? 'Налаштування двофакторної автентифікації' : 'Підтвердження входу'}</div>
        {setup ? (
          <>
            <p>Відкрийте Google Authenticator або інший застосунок для одноразових кодів і відскануйте QR-код.</p>
            {setupData?.qrCodeDataUrl && <img className="qr-code" src={setupData.qrCodeDataUrl} alt="QR-код для Google Authenticator" />}
            {setupData?.manualEntryKey && <p><strong>Ключ для ручного введення:</strong><br /><code>{setupData.manualEntryKey}</code></p>}
          </>
        ) : <p>Введіть 6-значний код із Google Authenticator.</p>}
        <form onSubmit={submit}>
          <label>Код із застосунку<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></label>
          <button type="submit" disabled={submitting || code.length !== 6}>{submitting ? 'Перевірка…' : setup ? 'Підтвердити і увімкнути 2FA' : 'Підтвердити вхід'}</button>
        </form>
        {error && <p className="message error" role="alert">{error}</p>}
      </section>
    </main>
  );
}

function AdminLogin({ onLogin, sessionMessage }: { onLogin: (phase?: AdminAuthPhase, admin?: AdminUser) => void; sessionMessage?: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await loginAdmin(username, password);
      if (!response.success) {
        setError('Невірний логін або пароль адміністратора');
        return;
      }
      setError('');
      if (response.mustChangePassword) onLogin('change_password', response.admin);
      else if (response.requiresTwoFactorSetup) onLogin('setup_2fa', response.admin);
      else if (response.requiresTwoFactor) onLogin('verify_2fa', response.admin);
      else onLogin(undefined, response.admin);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Сервер недоступний. Спробуйте пізніше.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="login-titlebar">Авторизація адміністратора</div>
        <p>Доступ лише для уповноважених осіб</p>
        {sessionMessage && <p className="message warning" role="status">{sessionMessage}</p>}
        <form onSubmit={submit}>
          <label>
            Логін
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button type="submit" disabled={submitting}>{submitting ? 'Вхід…' : 'Увійти'}</button>
        </form>
        {error && <p className="message error" role="alert">{error}</p>}
      </section>
    </main>
  );
}

export function AdminRoute() {
  const [authenticated, setAuthenticated] = useState(false);
  const [admin, setAdmin] = useState(() => getCurrentAdmin());
  const [phase, setPhase] = useState<AdminAuthPhase>(() => isAdminAuthenticated() ? 'login' : 'login');
  const [sessionMessage, setSessionMessage] = useState('');
  const [checkingSession, setCheckingSession] = useState(() => isAdminAuthenticated());

  function logout() {
    logoutAdmin();
    setAuthenticated(false);
    setAdmin(null);
    setSessionMessage('');
    setPhase('login');
  }

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      setCheckingSession(false);
      return;
    }
    let active = true;
    getMyAdminProfile()
      .then((profile) => {
        if (!active) return;
        setAdmin(profile);
        setAuthenticated(true);
      })
      .catch(() => {
        if (!active) return;
        logoutAdmin();
        setAdmin(null);
        setAuthenticated(false);
        setSessionMessage('Сесія завершилась. Увійдіть повторно.');
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function expire() {
      setAuthenticated(false);
      setAdmin(null);
      setSessionMessage('Сесія завершилась. Увійдіть повторно.');
      setPhase('login');
    }
    window.addEventListener('admin-session-expired', expire);
    return () => window.removeEventListener('admin-session-expired', expire);
  }, []);

  if (phase === 'change_password') return <PasswordChangeForm forced onChanged={logout} onCancel={logout} />;
  if (phase === 'setup_2fa') return <TwoFactorCodeForm setup onVerified={(verifiedAdmin) => { setAdmin(verifiedAdmin); setAuthenticated(true); setPhase('login'); }} />;
  if (phase === 'verify_2fa') return <TwoFactorCodeForm onVerified={(verifiedAdmin) => { setAdmin(verifiedAdmin); setAuthenticated(true); setPhase('login'); }} />;
  if (checkingSession) return <main className="admin-login-page"><section className="admin-login-card"><div className="login-titlebar">Перевірка сесії адміністратора</div><p>Перевіряємо доступ через сервер…</p></section></main>;

  return authenticated && admin
    ? admin.mustChangePassword
      ? <PasswordChangeForm forced onChanged={logout} onCancel={logout} />
      : <AdminPage admin={admin} onLogout={logout} />
    : <AdminLogin sessionMessage={sessionMessage} onLogin={(nextPhase, loginAdminUser) => {
      setSessionMessage('');
      if (nextPhase) {
        setAdmin(loginAdminUser ?? null);
        setPhase(nextPhase);
        return;
      }
      setAdmin(getCurrentAdmin());
      setAuthenticated(true);
    }} />;
}
