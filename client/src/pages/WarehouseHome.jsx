import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';

// Placeholder for the warehouse order view, which arrives in Phase 3.
export default function WarehouseHome() {
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <div className="page narrow">
      <h1>{t('home.welcome', { name: user.name })}</h1>
      <section className="card highlight">
        <h2>{t('warehouse.soonTitle')}</h2>
        <p>{t('warehouse.soonText')}</p>
      </section>
    </div>
  );
}
