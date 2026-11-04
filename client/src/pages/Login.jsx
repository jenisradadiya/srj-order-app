import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import AuthScreen from '../components/AuthScreen.jsx';
import { ErrorText, Field, PinInput } from '../components/ui.jsx';

const LAST_PHONE_KEY = 'srj.lastPhone';

function readLastPhone() {
  try {
    return localStorage.getItem(LAST_PHONE_KEY) || '';
  } catch {
    return '';
  }
}

export default function Login() {
  const { t, te } = useI18n();
  const { signedIn } = useAuth();
  // Remember the phone number so people only have to type their PIN next time.
  const [phone, setPhone] = useState(readLastPhone);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { user } = await api('/auth/login', { method: 'POST', body: { phone, pin } });
      try {
        localStorage.setItem(LAST_PHONE_KEY, phone);
      } catch {
        // Not remembered; harmless.
      }
      signedIn(user);
    } catch (err) {
      setError(te(err.code));
      setPin('');
      setBusy(false);
    }
  };

  return (
    <AuthScreen title={t('login.title')}>
      <form className="stack" onSubmit={submit}>
        <Field label={t('fields.phone')}>
          <input type="tel" inputMode="tel" autoComplete="tel" required placeholder="0151 2345678"
            value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus={!phone} />
        </Field>
        <Field label={t('login.pin')}>
          <PinInput value={pin} onChange={setPin} autoFocus={Boolean(phone)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <button className="btn primary block" disabled={busy || pin.length !== 4}>
          {t('login.submit')}
        </button>
        <p className="muted small center">{t('login.forgot')}</p>
        <Link to="/legal" className="muted small center">{t('legal.link')}</Link>
      </form>
    </AuthScreen>
  );
}
