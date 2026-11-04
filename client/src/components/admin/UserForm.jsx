import { useState } from 'react';
import { api } from '../../api.js';
import { useI18n, LANGUAGES } from '../../i18n/index.jsx';
import { ErrorText, Field, Modal } from '../ui.jsx';

const ROLE_OPTIONS = { customer: ['owner', 'staff'], team: ['admin', 'warehouse'] };

// Add or edit a user. mode "customer" = owner/staff of `customer`; mode "team" = admin/warehouse.
export default function UserForm({ mode, customer, branches = [], user, onClose, onSaved }) {
  const { t, te } = useI18n();
  const roles = ROLE_OPTIONS[mode];
  const [form, setForm] = useState({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    role: user?.role ?? roles[0],
    branchId: user?.branchId ?? branches[0]?.id ?? '',
    language: user?.language ?? 'de',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const body = {
      name: form.name,
      phone: form.phone,
      role: form.role,
      language: form.language,
      ...(mode === 'customer' && { customerId: customer.id, branchId: form.role === 'staff' ? Number(form.branchId) : null }),
    };
    try {
      const result = user
        ? await api(`/admin/users/${user.id}`, { method: 'PATCH', body })
        : await api('/admin/users', { method: 'POST', body });
      onSaved(result.user, result.pin);
    } catch (err) {
      setError(te(err.code));
      setBusy(false);
    }
  };

  return (
    <Modal title={user ? t('users.edit') : t('users.add')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label={t('fields.name')}>
          <input required value={form.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label={t('fields.phone')} hint={t('users.phoneHint')}>
          <input type="tel" inputMode="tel" required placeholder="0151 2345678" value={form.phone} onChange={set('phone')} />
        </Field>

        <fieldset className="field">
          <legend className="field-label">{t('fields.role')}</legend>
          <div className="role-options">
            {roles.map((r) => (
              <label key={r} className={`role-option ${form.role === r ? 'selected' : ''}`}>
                <input type="radio" name="role" value={r} checked={form.role === r} onChange={set('role')} />
                <strong>{t(`roles.${r}`)}</strong>
                <span className="muted small">{t(`roleHints.${r}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {mode === 'customer' && form.role === 'staff' && (
          <Field label={t('fields.branch')}>
            <select required value={form.branchId} onChange={set('branchId')}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}{b.city && ` (${b.city})`}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label={t('fields.language')}>
          <select value={form.language} onChange={set('language')}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </Field>

        {!user && <p className="muted small">{t('users.pinWillBeCreated')}</p>}
        <ErrorText>{error}</ErrorText>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={busy}>{user ? t('common.save') : t('users.add')}</button>
        </div>
      </form>
    </Modal>
  );
}
