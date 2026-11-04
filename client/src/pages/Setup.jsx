import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n/index.jsx';
import AuthScreen from '../components/AuthScreen.jsx';
import { ErrorText, Field, PinInput } from '../components/ui.jsx';

// Shown only on the very first start, when no accounts exist yet.
export default function Setup() {
  const { t, te, lang } = useI18n();
  const { signedIn } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', pin: '', pin2: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.pin !== form.pin2) return setError(te('pin_mismatch'));
    setBusy(true);
    try {
      const { user } = await api('/setup', {
        method: 'POST',
        body: { name: form.name, phone: form.phone, pin: form.pin, language: lang },
      });
      signedIn(user);
    } catch (err) {
      setError(te(err.code));
      setBusy(false);
    }
  };

  return (
    <AuthScreen title={t('setup.title')} intro={t('setup.intro')}>
      <form className="stack" onSubmit={submit}>
        <Field label={t('fields.name')}>
          <input required autoComplete="name" value={form.name} onChange={(e) => set('name')(e.target.value)} />
        </Field>
        <Field label={t('fields.phone')} hint={t('fields.phoneHint')}>
          <input type="tel" inputMode="tel" autoComplete="tel" required placeholder="0151 2345678"
            value={form.phone} onChange={(e) => set('phone')(e.target.value)} />
        </Field>
        <Field label={t('profile.newPin')}>
          <PinInput value={form.pin} onChange={set('pin')} autoComplete="new-password" />
        </Field>
        <Field label={t('profile.confirmPin')}>
          <PinInput value={form.pin2} onChange={set('pin2')} autoComplete="new-password" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <button className="btn primary block" disabled={busy}>{t('setup.submit')}</button>
      </form>
    </AuthScreen>
  );
}
