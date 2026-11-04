import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useI18n } from '../../i18n/index.jsx';
import FinishedList from '../../components/team/FinishedList.jsx';

// Out-of-stock list. Admins also see the latest missing-item notes from all orders.
export default function Stock() {
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <div className="page narrow">
      <h1>{t('finished.title')}</h1>
      <FinishedList />
      {user.role === 'admin' && <RecentMissing />}
    </div>
  );
}

export function RecentMissing({ limit = 50, compact = false }) {
  const { t, formatDate } = useI18n();
  const [notes, setNotes] = useState(null);

  useEffect(() => {
    api(`/team/missing?limit=${limit}`).then((d) => setNotes(d.notes)).catch(() => setNotes([]));
  }, [limit]);

  if (!notes || (compact && notes.length === 0)) return null;
  return (
    <section className="card">
      <h2>{t('missing.recentTitle')}</h2>
      {notes.length === 0 && <p className="muted">{t('missing.none')}</p>}
      <ul className="plain-list note-list">
        {notes.map((n) => (
          <li key={n.id} className="note-row">
            <div>
              <strong>{n.text}</strong>
              <div className="muted small">
                <Link to={`/admin/orders/${n.orderId}`}>#{n.orderId} · {n.customerName}</Link> · {n.userName} · {formatDate(n.createdAt)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
