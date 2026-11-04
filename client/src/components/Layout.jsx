import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, homePath } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Icon } from './ui.jsx';
import { SetupBanner } from './AppSetup.jsx';

const PROFILE = { to: '/profile', label: 'nav.profile', icon: 'user' };

const NAV = {
  admin: [
    { to: '/admin', label: 'nav.dashboard', icon: 'home', end: true },
    { to: '/admin/orders', label: 'nav.orders', icon: 'list', badge: 'newOrders' },
    { to: '/admin/customers', label: 'nav.customers', icon: 'store' },
    { to: '/admin/bills', label: 'nav.bills', icon: 'euro' },
    // On phones these are reached from the Profile page.
    { to: '/admin/routes', label: 'nav.routes', icon: 'pin', desktopOnly: true },
    { to: '/admin/products', label: 'nav.products', icon: 'tag', desktopOnly: true },
    { to: '/admin/stock', label: 'nav.stock', icon: 'box', desktopOnly: true },
    { to: '/admin/team', label: 'nav.team', icon: 'users', desktopOnly: true },
    PROFILE,
  ],
  warehouse: [
    { to: '/warehouse', label: 'nav.today', icon: 'pin', end: true },
    { to: '/warehouse/orders', label: 'nav.orders', icon: 'list' },
    { to: '/warehouse/stock', label: 'nav.stock', icon: 'box' },
    PROFILE,
  ],
  owner: [
    { to: '/order', label: 'nav.order', icon: 'cart' },
    { to: '/orders', label: 'nav.myOrders', icon: 'list' },
    { to: '/bills', label: 'nav.bills', icon: 'euro' },
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

// Unread notifications, for the bell.
function useUnreadCount() {
  const [count, setCount] = useState(0);
  const location = useLocation();
  useEffect(() => {
    const load = () => api('/notifications/count').then((d) => setCount(d.unread)).catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    const onRead = () => setCount(0);
    window.addEventListener('srj:notifications-read', onRead);
    return () => {
      clearInterval(timer);
      window.removeEventListener('srj:notifications-read', onRead);
    };
  }, [location.pathname]);
  return count;
}

export default function Layout({ children }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const newOrders = useNewOrderCount(user.role === 'admin');
  const unread = useUnreadCount();
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
        <NavLink to="/notifications" className="bell" aria-label={t('notifications.title')}>
          <Icon name="bell" />
          {unread > 0 && <span className="nav-badge">{unread > 99 ? '99+' : unread}</span>}
        </NavLink>
      </header>
      <main className="content">
        <SetupBanner />
        {children}
      </main>
    </div>
  );
}
