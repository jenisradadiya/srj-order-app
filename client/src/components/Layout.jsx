import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, homePath } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Icon } from './ui.jsx';

const PROFILE = { to: '/profile', label: 'nav.profile', icon: 'user' };

const NAV = {
  admin: [
    { to: '/admin', label: 'nav.dashboard', icon: 'home', end: true },
    { to: '/admin/orders', label: 'nav.orders', icon: 'list', badge: 'newOrders' },
    { to: '/admin/customers', label: 'nav.customers', icon: 'store' },
    { to: '/admin/products', label: 'nav.products', icon: 'tag' },
    { to: '/admin/team', label: 'nav.team', icon: 'users', desktopOnly: true }, // on phones: via Profile
    PROFILE,
  ],
  warehouse: [{ to: '/warehouse', label: 'nav.orders', icon: 'box' }, PROFILE],
  owner: [
    { to: '/order', label: 'nav.order', icon: 'cart' },
    { to: '/orders', label: 'nav.myOrders', icon: 'list' },
    PROFILE,
  ],
  staff: [
    { to: '/order', label: 'nav.order', icon: 'cart' },
    { to: '/orders', label: 'nav.myOrders', icon: 'list' },
    PROFILE,
  ],
};

// Number of new (not yet accepted) orders, for the admin menu badge.
function useNewOrderCount(enabled) {
  const [count, setCount] = useState(0);
  const location = useLocation();
  useEffect(() => {
    if (!enabled) return undefined;
    const load = () => api('/admin/stats').then((s) => setCount(s.newOrders)).catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [enabled, location.pathname]);
  return count;
}

export default function Layout({ children }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const newOrders = useNewOrderCount(user.role === 'admin');
  const badges = { newOrders };

  return (
    <div className="layout">
      <header className="topbar">
        <Link to={homePath(user.role)} className="brand" aria-label="SRJ">
          <img src="/logo.svg" alt="SRJ" />
        </Link>
        <nav className="nav" aria-label={t('nav.main')}>
          {NAV[user.role].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={`nav-item ${item.desktopOnly ? 'desktop-only' : ''}`}>
              <span className="nav-icon">
                <Icon name={item.icon} />
                {item.badge && badges[item.badge] > 0 && <span className="nav-badge">{badges[item.badge]}</span>}
              </span>
              <span>{t(item.label)}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
