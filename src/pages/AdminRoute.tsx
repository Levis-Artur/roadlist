import { useState } from 'react';
import { isAdminAuthenticated, loginAdmin, logoutAdmin } from '../services/adminService';
import { AdminPage } from './AdminPage';

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (!await loginAdmin(password)) {
        setError('Невірний пароль адміністратора');
        return;
      }
      setError('');
      onLogin();
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
        <form onSubmit={submit}>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
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
  const [authenticated, setAuthenticated] = useState(
    () => isAdminAuthenticated(),
  );

  function logout() {
    logoutAdmin();
    setAuthenticated(false);
  }

  return authenticated ? <AdminPage onLogout={logout} /> : <AdminLogin onLogin={() => setAuthenticated(true)} />;
}
