import { Link, NavLink } from 'react-router-dom';
import { useAuth, homePath } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Icon } from './ui.jsx';

const PROFILE = { to: '/profile', label: 'nav.profile', icon: 'user' };

const NAV = {
  admin: [
    { to: '/admin', label: 'nav.dashboard', icon: 'home', end: true },
    { to: '/admin/customers', label: 'nav.customers', icon: 'store' },
    { to: '/admin/team', label: 'nav.team', icon: 'users' },
    PROFILE,
  ],
  warehouse: [{ to: '/warehouse', label: 'nav.orders', icon: 'box' }, PROFILE],
  owner: [{ to: '/home', label: 'nav.home', icon: 'home' }, PROFILE],
  staff: [{ to: '/home', label: 'nav.home', icon: 'home' }, PROFILE],
};

export default function Layout({ children }) {
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <div className="layout">
      <header className="topbar">
        <Link to={homePath(user.role)} className="brand" aria-label="SRJ">
          <img src="/logo.svg" alt="SRJ" />
        </Link>
        <nav className="nav" aria-label={t('nav.main')}>
          {NAV[user.role].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-item">
              <Icon name={item.icon} />
              <span>{t(item.label)}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
