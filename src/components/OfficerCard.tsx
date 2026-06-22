import type { Officer } from '../types';

export function OfficerCard({ officer }: { officer: Officer }) {
  return (
    <section className="officer-card" aria-label="Дані патрульного">
      <div className="officer-card-header">
        <strong>Дані працівника</strong>
        <span className="verified-badge">Перевірено</span>
      </div>
      <dl>
        <div><dt>ПІБ</dt><dd>{officer.fullName}</dd></div>
        <div><dt>Номер жетона</dt><dd>{officer.badgeNumber}</dd></div>
        <div><dt>УПП</dt><dd>{officer.department}</dd></div>
        <div><dt>Статус</dt><dd><span className="verified-badge">Перевірено</span></dd></div>
      </dl>
    </section>
  );
}
