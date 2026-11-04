import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Icon } from '../components/ui.jsx';

// Placeholder start page for restaurant owners and staff. Ordering arrives in Phase 2.
export default function CustomerHome() {
  const { t } = useI18n();
  const { user } = useAuth();

  return (
    <div className="page narrow">
      <h1>{t('home.welcome', { name: user.name })}</h1>
      <p className="muted">{user.customer?.name}</p>

      <section className="card highlight">
        <h2>{t('home.soonTitle')}</h2>
        <p>{t('home.soonText')}</p>
      </section>

      <section className="card">
        <h2>{user.role === 'owner' ? t('home.yourBranches') : t('home.yourBranch')}</h2>
        <ul className="plain-list">
          {user.branches.map((b) => (
            <li key={b.id} className="list-row">
              <Icon name="pin" />
              <div>
                <strong>{b.name}</strong>
                <div className="muted small">{[b.street, [b.postalCode, b.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
