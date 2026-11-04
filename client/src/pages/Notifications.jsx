import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { ErrorText, Icon, Spinner } from '../components/ui.jsx';

// The bell: everything the app told this person, newest first.
export default function Notifications() {
  const { t, te, formatDate } = useI18n();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/notifications')
      .then((d) => {
        setItems(d.notifications);
        // Opening the list marks everything as read.
        if (d.notifications.some((n) => !n.readAt)) {
          api('/notifications/read', { method: 'POST' })
            .then(() => window.dispatchEvent(new Event('srj:notifications-read')))
            .catch(() => {});
        }
      })
      .catch((err) => setError(te(err.code)));
  }, [te]);

  return (
    <div className="page narrow">
      <h1>{t('notifications.title')}</h1>
      <ErrorText>{error}</ErrorText>
      {!items && !error && <Spinner />}
      {items?.length === 0 && <p className="muted center">{t('notifications.empty')}</p>}
      <ul className="plain-list customer-list">
        {items?.map((n) => (
          <li key={n.id}>
            <Link to={n.url} className={`customer-card notification ${n.readAt ? '' : 'unread'}`}>
              <span className="notif-icon"><Icon name={ICONS[n.kind] || 'bell'} size={18} /></span>
              <div className="grow">
                <strong>{n.title}</strong>
                <div className="small">{n.body}</div>
                <div className="muted small">{formatDate(n.createdAt)}</div>
              </div>
              <Icon name="chevron" />
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/profile#app" className="muted small center">{t('notifications.settings')}</Link>
    </div>
  );
}

const ICONS = { newOrder: 'list', accepted: 'check', newBill: 'euro', reminder: 'pin', test: 'bell' };
