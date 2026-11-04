import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import {
  canPromptInstall, currentSubscription, disablePush, enablePush, isIOS, isStandalone, permission, promptInstall, pushSupported,
} from '../lib/push.js';
import { ErrorText, Icon } from './ui.jsx';

// "Install the app" help: a real button where the browser allows it,
// otherwise short steps (iPhone: Share → Add to Home Screen).
export function InstallGuide() {
  const { t } = useI18n();
  const [installable, setInstallable] = useState(canPromptInstall());

  useEffect(() => {
    const update = () => setInstallable(canPromptInstall());
    window.addEventListener('srj:installable', update);
    return () => window.removeEventListener('srj:installable', update);
  }, []);

  if (isStandalone()) {
    return <p className="success-line"><Icon name="check" size={18} /> {t('appSetup.installed')}</p>;
  }
  if (installable) {
    return (
      <div className="stack">
        <p className="muted small">{t('appSetup.installIntro')}</p>
        <button className="btn primary" onClick={promptInstall}><Icon name="plus" /> {t('appSetup.installButton')}</button>
      </div>
    );
  }
  if (isIOS()) {
    return (
      <ol className="steps">
        <li>{t('appSetup.ios1')} <span className="share-icon" aria-hidden="true">⬆︎</span></li>
        <li>{t('appSetup.ios2')}</li>
        <li>{t('appSetup.ios3')}</li>
      </ol>
    );
  }
  return (
    <ol className="steps">
      <li>{t('appSetup.android1')}</li>
      <li>{t('appSetup.android2')}</li>
    </ol>
  );
}

// Turn push notifications on/off for this phone, with a test button.
export function NotificationSetup() {
  const { t } = useI18n();
  const [state, setState] = useState('loading'); // loading | on | off | denied | needInstall | insecure | unsupported
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ error: '', ok: '' });

  const refresh = async () => {
    if (!window.isSecureContext) return setState('insecure');
    if (isIOS() && !isStandalone()) return setState('needInstall');
    if (!pushSupported()) return setState('unsupported');
    if (permission() === 'denied') return setState('denied');
    const sub = await currentSubscription().catch(() => null);
    setState(sub && permission() === 'granted' ? 'on' : 'off');
  };

  useEffect(() => {
    refresh();
  }, []);

  const run = async (fn, ok = '') => {
    setBusy(true);
    setMessage({ error: '', ok: '' });
    try {
      await fn();
      setMessage({ error: '', ok });
    } catch (err) {
      // denied = the person said no; AbortError/NotAllowedError = the browser refused (e.g. private mode).
      const text =
        err?.message === 'denied' ? t('appSetup.deniedNow')
          : err?.code ? t('errors.server_error')
            : t('appSetup.failed');
      setMessage({ error: text, ok: '' });
    } finally {
      setBusy(false);
      refresh();
      window.dispatchEvent(new Event('srj:push-changed'));
    }
  };

  return (
    <div className="stack">
      {state === 'on' && (
        <>
          <p className="success-line"><Icon name="check" size={18} /> {t('appSetup.notificationsOn')}</p>
          <div className="row-actions">
            <button className="btn small" disabled={busy}
              onClick={() => run(() => api('/push/test', { method: 'POST' }), t('appSetup.testSent'))}>
              {t('appSetup.sendTest')}
            </button>
            <button className="btn small ghost" disabled={busy} onClick={() => run(disablePush)}>{t('appSetup.turnOff')}</button>
          </div>
        </>
      )}
      {state === 'off' && (
        <>
          <p className="muted small">{t('appSetup.notificationsIntro')}</p>
          <button className="btn primary" disabled={busy} onClick={() => run(enablePush)}>
            <Icon name="bell" /> {t('appSetup.turnOn')}
          </button>
        </>
      )}
      {state === 'denied' && <p className="notice small">{t('appSetup.denied')}</p>}
      {state === 'needInstall' && <p className="notice small">{t('appSetup.iosFirstInstall')}</p>}
      {state === 'insecure' && <p className="notice small">{t('appSetup.needsHttps')}</p>}
      {state === 'unsupported' && <p className="notice small">{t('appSetup.unsupported')}</p>}
      <ErrorText>{message.error}</ErrorText>
      {message.ok && <p className="success small" role="status">{message.ok}</p>}
    </div>
  );
}

const DISMISS_KEY = 'srj.setupBanner';

// A small hint at the top of the main screen until the app is installed and notifications are on.
export function SetupBanner() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // ignore
    }
    if (dismissed) return undefined;
    const check = async () => {
      const needsInstall = !isStandalone() && window.matchMedia?.('(max-width: 720px)').matches;
      const sub = pushSupported() ? await currentSubscription().catch(() => null) : null;
      const needsPush = pushSupported() && permission() !== 'denied' && !sub;
      setShow(needsInstall || needsPush);
    };
    check();
    window.addEventListener('srj:push-changed', check);
    window.addEventListener('srj:installable', check);
    return () => {
      window.removeEventListener('srj:push-changed', check);
      window.removeEventListener('srj:installable', check);
    };
  }, []);

  // On the profile page the setup itself is shown, so no hint needed there.
  if (!show || pathname === '/profile') return null;
  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };
  return (
    <div className="setup-banner">
      <Icon name="bell" />
      <Link to="/profile#app" className="grow">{t('appSetup.banner')}</Link>
      <button className="icon-btn small" onClick={dismiss} aria-label={t('common.close')}><Icon name="close" size={16} /></button>
    </div>
  );
}
