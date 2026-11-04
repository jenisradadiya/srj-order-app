import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { branchAddress } from '../components/OrderView.jsx';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import { ErrorText, Field, Icon, LanguageSwitcher, PinInput, formatPhone } from '../components/ui.jsx';
import { InstallGuide, NotificationSetup } from '../components/AppSetup.jsx';

export default function Profile() {
  const { t, te, lang, setLang } = useI18n();
  const { user, updateUser, logout } = useAuth();
  const [langError, setLangError] = useState('');

  const changeLanguage = async (next) => {
    setLangError('');
    const previous = lang;
    setLang(next);
    try {
      const { user: updated } = await api('/me', { method: 'PATCH', body: { language: next } });
      updateUser(updated);
    } catch (err) {
      setLang(previous);
      setLangError(te(err.code));
    }
  };

  return (
    <div className="page narrow">
      <h1>{t('profile.title')}</h1>

      <section className="card">
        <div className="profile-head">
          <div className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{user.name}</strong>
            <div className="muted">{formatPhone(user.phone)}</div>
            <span className={`badge role-${user.role}`}>{t(`roles.${user.role}`)}</span>
          </div>
        </div>
        {user.customer && <p className="muted small">{user.customer.name}</p>}
      </section>

      {user.branches.length > 0 && (
        <section className="card">
          <h2>{user.branches.length > 1 ? t('home.yourBranches') : t('home.yourBranch')}</h2>
          <ul className="plain-list">
            {user.branches.map((b) => (
              <li key={b.id} className="list-row">
                <Icon name="pin" />
                <div>
                  <strong>{b.name}</strong>
                  <div className="muted small">{branchAddress(b)}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {user.role === 'admin' && (
        <div className="mobile-only stack">
          {[
            { to: '/admin/routes', icon: 'pin', label: 'nav.routes' },
            { to: '/admin/products', icon: 'tag', label: 'nav.products' },
            { to: '/admin/stock', icon: 'box', label: 'nav.stock' },
            { to: '/admin/team', icon: 'users', label: 'nav.team' },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="customer-card">
              <span className="icon-label"><Icon name={l.icon} /> {t(l.label)}</span>
              <Icon name="chevron" />
            </Link>
          ))}
        </div>
      )}

      <section className="card stack" id="app">
        <h2>{t('appSetup.appTitle')}</h2>
        <InstallGuide />
        <h3>{t('appSetup.notificationsTitle')}</h3>
        <NotificationSetup />
      </section>

      <section className="card">
        <h2>{t('fields.language')}</h2>
        <LanguageSwitcher value={lang} onChange={changeLanguage} />
        <ErrorText>{langError}</ErrorText>
      </section>

      <ChangePin />

      <button className="btn block" onClick={logout}>
        <Icon name="logout" /> {t('profile.logout')}
      </button>
      <Link to="/legal" className="muted small center">{t('legal.link')}</Link>
    </div>
  );
}

function ChangePin() {
  const { t, te } = useI18n();
  const empty = { currentPin: '', newPin: '', confirmPin: '' };
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState({ error: '', ok: '' });
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPin !== form.confirmPin) return setMessage({ error: te('pin_mismatch'), ok: '' });
    setBusy(true);
    try {
      await api('/me/pin', { method: 'POST', body: { currentPin: form.currentPin, newPin: form.newPin } });
      setForm(empty);
      setMessage({ error: '', ok: t('profile.pinChanged') });
    } catch (err) {
      setMessage({ error: te(err.code), ok: '' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>{t('profile.changePin')}</h2>
      <Field label={t('profile.currentPin')}>
        <PinInput value={form.currentPin} onChange={set('currentPin')} />
      </Field>
      <Field label={t('profile.newPin')}>
        <PinInput value={form.newPin} onChange={set('newPin')} autoComplete="new-password" />
      </Field>
      <Field label={t('profile.confirmPin')}>
        <PinInput value={form.confirmPin} onChange={set('confirmPin')} autoComplete="new-password" />
      </Field>
      <ErrorText>{message.error}</ErrorText>
      {message.ok && <p className="success" role="status">{message.ok}</p>}
      <button className="btn primary" disabled={busy}>{t('profile.changePin')}</button>
    </form>
  );
}
