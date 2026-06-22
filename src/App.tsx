import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AdminRoute } from './pages/AdminRoute';
import { PatrolPage } from './pages/PatrolPage';
import { cleanupExpiredPhotos } from './services/photoService';
import mvsBadge from './assets/mvs-badge.svg';

function AppHeader() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const currentDate = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand-block">
            <span className="brand-mark"><img src={mvsBadge} alt="Емблема МВС" /></span>
            <div><strong>Патрульна поліція</strong><span>Електронний маршрутний лист</span></div>
          </div>
          <div className="system-meta"><span>{isAdmin ? 'Роль: Адміністратор' : 'Роль: Патрульний'}</span><time>{currentDate}</time></div>
        </div>
      </header>
      <div className="module-bar"><span>Робочий стіл</span><b>/</b><strong>{isAdmin ? 'Адміністративна панель' : 'Маршрутний лист'}</strong></div>
    </>
  );
}

function StatusBar() {
  return <footer className="status-bar"><span>Система готова</span><span>API з локальним резервом</span></footer>;
}

export default function App() {
  useEffect(() => {
    void cleanupExpiredPhotos().catch(() => undefined);
  }, []);
  return (
    <BrowserRouter>
      <div className="app-shell">
        <AppHeader />
        <Routes>
          <Route path="/" element={<PatrolPage />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <StatusBar />
      </div>
    </BrowserRouter>
  );
}
