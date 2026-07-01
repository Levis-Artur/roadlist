import type { AuditLog } from '../../types';
import { formatDate } from '../../utils/format';

export function AuditLogSection({ auditLogs, hidden }: { auditLogs: AuditLog[]; hidden: boolean }) {
  return (
    <section className="audit-section" hidden={hidden}>
      <div className="registry-heading"><span className="eyebrow">Системний реєстр</span><h2>Журнал подій</h2></div>
      {!auditLogs.length ? (
        <div className="empty-state compact-empty"><p>Записів журналу ще немає.</p></div>
      ) : (
        <div className="table-card"><div className="table-scroll">
          <table className="responsive-table audit-table">
            <thead><tr><th>Дата/час</th><th>Дія</th><th>Тип сутності</th><th>Номер жетона</th><th>Деталі</th></tr></thead>
            <tbody>{auditLogs.map((log) => (
              <tr key={log.id}><td>{formatDate(log.createdAt)}</td><td>{log.action}</td><td>{log.entityType}</td><td>{log.badgeNumber ?? '—'}</td><td>{log.details ?? '—'}</td></tr>
            ))}</tbody>
          </table>
        </div></div>
      )}
    </section>
  );
}
