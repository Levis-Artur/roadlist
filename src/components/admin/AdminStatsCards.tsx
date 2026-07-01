interface AdminStats {
  total: number;
  active: number;
  completed: number;
  needsReview: number;
  verified: number;
  distance: number;
  activeOfficers: number;
  activeVehicles: number;
}

export function AdminStatsCards({ stats, hidden }: { stats: AdminStats; hidden: boolean }) {
  return (
    <section className="stats-grid" aria-label="Статистика маршрутних листів" hidden={hidden}>
      <article><span>Всього листів</span><strong>{stats.total}</strong></article>
      <article><span>Активні зміни</span><strong>{stats.active}</strong></article>
      <article><span>Завершені</span><strong>{stats.completed}</strong></article>
      <article className="warning-stat"><span>Потребують перевірки</span><strong>{stats.needsReview}</strong></article>
      <article><span>Перевірено</span><strong>{stats.verified}</strong></article>
      <article><span>Сумарний пробіг</span><strong>{stats.distance.toLocaleString('uk-UA')} <small>км</small></strong></article>
      <article><span>Активні патрульні</span><strong>{stats.activeOfficers}</strong></article>
      <article><span>Активні автомобілі</span><strong>{stats.activeVehicles}</strong></article>
    </section>
  );
}
