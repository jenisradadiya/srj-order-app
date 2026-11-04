import { useState } from 'react';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { ErrorText, Field, Modal } from '../ui.jsx';

const emptyBranch = { name: '', street: '', postalCode: '', city: '', phone: '' };

function BranchFields({ value, onChange, nameOptional }) {
  const { t } = useI18n();
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  return (
    <>
      <Field label={t('fields.branchName')} hint={nameOptional ? t('customers.branchNameHint') : undefined}>
        <input required={!nameOptional} value={value.name} onChange={set('name')} />
      </Field>
      <Field label={t('fields.street')}>
        <input autoComplete="street-address" value={value.street} onChange={set('street')} />
      </Field>
      <div className="field-row">
        <Field label={t('fields.postalCode')}>
          <input inputMode="numeric" autoComplete="postal-code" value={value.postalCode} onChange={set('postalCode')} />
        </Field>
        <Field label={t('fields.city')}>
          <input value={value.city} onChange={set('city')} />
        </Field>
      </div>
      <Field label={`${t('fields.phone')} (${t('common.optional')})`}>
        <input type="tel" inputMode="tel" value={value.phone} onChange={set('phone')} />
      </Field>
    </>
  );
}

function useSubmit(action, onSaved) {
  const { te } = useI18n();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      onSaved(await action());
    } catch (err) {
      setError(te(err.code));
      setBusy(false);
    }
  };
  return { error, busy, submit };
}

// New customer (with its first branch) or edit name/notes of an existing one.
export function CustomerForm({ customer, onClose, onSaved }) {
  const { t } = useI18n();
  const [name, setName] = useState(customer?.name ?? '');
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const [branch, setBranch] = useState(emptyBranch);
  const { error, busy, submit } = useSubmit(
    () =>
      customer
        ? api(`/admin/customers/${customer.id}`, { method: 'PATCH', body: { name, notes } })
        : api('/admin/customers', { method: 'POST', body: { name, notes, branch } }),
    onSaved
  );

  return (
    <Modal title={customer ? t('customers.edit') : t('customers.add')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label={t('fields.companyName')}>
          <input required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={`${t('fields.notes')} (${t('common.optional')})`}>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {!customer && (
          <>
            <h3 className="form-subtitle">{t('customers.firstBranch')}</h3>
            <BranchFields value={branch} onChange={setBranch} nameOptional />
          </>
        )}
        <ErrorText>{error}</ErrorText>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={busy}>{t('common.save')}</button>
        </div>
      </form>
    </Modal>
  );
}

export function BranchForm({ customerId, branch, onClose, onSaved }) {
  const { t } = useI18n();
  const [value, setValue] = useState(branch ? { ...emptyBranch, ...branch } : emptyBranch);
  const { error, busy, submit } = useSubmit(
    () =>
      branch
        ? api(`/admin/branches/${branch.id}`, { method: 'PATCH', body: value })
        : api(`/admin/customers/${customerId}/branches`, { method: 'POST', body: value }),
    onSaved
  );

  return (
    <Modal title={branch ? t('branches.edit') : t('branches.add')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <BranchFields value={value} onChange={setValue} />
        <ErrorText>{error}</ErrorText>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={busy}>{t('common.save')}</button>
        </div>
      </form>
    </Modal>
  );
}
