import { useState } from 'react';
import { getCurrentAdmin, isAdminAuthenticated, loginAdmin, logoutAdmin } from '../services/adminService';
import { AdminPage } from './AdminPage';

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (!await loginAdmin(username, password)) {
        setError('Невірний логін або пароль адміністратора');
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
  const [authenticated, setAuthenticated] = useState(
    () => isAdminAuthenticated(),
  );
  const [admin, setAdmin] = useState(() => getCurrentAdmin());

  function logout() {
    logoutAdmin();
    setAuthenticated(false);
    setAdmin(null);
  }

  return authenticated && admin
    ? <AdminPage admin={admin} onLogout={logout} />
    : <AdminLogin onLogin={() => { setAdmin(getCurrentAdmin()); setAuthenticated(true); }} />;
}
