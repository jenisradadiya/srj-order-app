import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { ErrorText, Icon, Spinner } from '../../components/ui.jsx';
import { RecentMissing } from '../team/Stock.jsx';

export default function Dashboard() {
  const { t, te } = useI18n();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/admin/stats').then(setStats).catch((err) => setError(te(err.code)));
  }, [te]);

  const tiles = stats && [
    { label: t('dashboard.newOrders'), value: stats.newOrders, to: '/admin/orders', highlight: stats.newOrders > 0 },
    { label: t('dashboard.acceptedOrders'), value: stats.acceptedOrders, to: '/admin/orders?status=accepted' },
    { label: t('dashboard.ordersToday'), value: stats.ordersToday, to: '/admin/orders?status=all' },
    { label: t('dashboard.customers'), value: stats.customers, to: '/admin/customers' },
    { label: t('dashboard.customerUsers'), value: stats.customerUsers, to: '/admin/customers' },
    { label: t('dashboard.products'), value: stats.products, to: '/admin/products' },
    { label: t('dashboard.outOfStock'), value: stats.outOfStock, to: '/admin/stock', highlight: stats.outOfStock > 0 },
    { label: t('dashboard.todayRoutes'), value: '→', to: '/admin/day' },
  ];

  return (
    <div className="page">
      <h1>{t('home.welcome', { name: user.name })}</h1>
      <ErrorText>{error}</ErrorText>
      {!stats && !error && <Spinner />}
      {stats && (
        <>
          <div className="stat-grid">
            {tiles.map((tile) => (
              <Link key={tile.label} to={tile.to} className={`stat ${tile.highlight ? 'highlight' : ''}`}>
                <span className="stat-value">{tile.value}</span>
                <span className="stat-label">{tile.label}</span>
              </Link>
            ))}
          </div>

          {stats.neverLoggedIn > 0 && (
            <p className="notice">{t('dashboard.neverLoggedIn', { count: stats.neverLoggedIn })}</p>
          )}
          {stats.products === 0 && (
            <p className="notice">
              {t('dashboard.noProducts')} <Link to="/admin/products/import">{t('products.import')}</Link>
            </p>
          )}

          <RecentMissing limit={5} compact />

          <section className="card">
            <h2>{t('dashboard.quickActions')}</h2>
            <div className="quick-actions">
              <Link className="btn" to="/admin/orders"><Icon name="list" /> {t('nav.orders')}</Link>
              <Link className="btn" to="/admin/customers?new=1"><Icon name="plus" /> {t('customers.add')}</Link>
              <Link className="btn" to="/admin/routes"><Icon name="pin" /> {t('nav.routes')}</Link>
              <Link className="btn" to="/admin/products"><Icon name="tag" /> {t('nav.products')}</Link>
              <Link className="btn" to="/admin/team"><Icon name="users" /> {t('nav.team')}</Link>
            </div>
          </section>

          <section className="card highlight">
            <h2>{t('dashboard.nextTitle')}</h2>
            <p>{t('dashboard.nextText')}</p>
          </section>
        </>
      )}
    </div>
  );
}
