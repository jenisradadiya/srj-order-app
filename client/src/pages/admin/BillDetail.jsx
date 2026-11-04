import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { centsToInput, parseMoney } from '../../lib/money.js';
import { formatDay, todayStr } from '../../lib/dates.js';
import { ErrorText, Field, Icon, Spinner } from '../../components/ui.jsx';
import { BillAmounts, BillForm, BillStatus, PaymentList } from '../../components/bills/BillParts.jsx';

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, te, lang, formatDate } = useI18n();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api(`/admin/invoices/${id}`).then((d) => setInvoice(d.invoice)).catch((err) => setError(te(err.code)));
  }, [id, te]);

  const remove = async () => {
    if (!confirm(t('bills.deleteConfirm', { number: invoice.number }))) return;
    try {
      await api(`/admin/invoices/${invoice.id}`, { method: 'DELETE' });
      navigate('/admin/bills');
    } catch (err) {
      setError(te(err.code));
    }
  };

  const deletePayment = async (p) => {
    if (!confirm(t('bills.deletePaymentConfirm'))) return;
    try {
      const d = await api(`/admin/payments/${p.id}`, { method: 'DELETE' });
      setInvoice(d.invoice);
    } catch (err) {
      setError(te(err.code));
    }
  };

  return (
    <div className="page narrow">
      <Link to="/admin/bills" className="back-link"><Icon name="back" size={18} /> {t('bills.title')}</Link>
      <ErrorText>{error}</ErrorText>
      {!invoice && !error && <Spinner />}
      {invoice && (
        <>
          <div className="section-head">
            <div>
              <h1>{t('bills.billNumber', { number: invoice.number })}</h1>
              <p className="muted small">
                <Link to={`/admin/customers/${invoice.customerId}`}>{invoice.customerName}</Link>
                {invoice.branchName && ` · ${invoice.branchName}`}
                {' · '}{formatDay(invoice.date, lang, { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <BillStatus status={invoice.status} />
          </div>

          <div className="row-actions">
            {invoice.hasFile && (
              <a className="btn primary small" href={`/api/admin/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                <Icon name="note" size={16} /> {t('bills.openPdf')}
              </a>
            )}
            {invoice.orderId && (
              <Link className="btn small" to={`/admin/orders/${invoice.orderId}`}>
                <Icon name="list" size={16} /> {t('orders.number', { id: invoice.orderId })}
              </Link>
            )}
            <button className="btn small" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> {t('common.edit')}</button>
            <button className="btn small danger" onClick={remove}><Icon name="trash" size={16} /> {t('common.delete')}</button>
          </div>
          {!invoice.hasFile && <p className="notice small">{t('bills.noPdfHint')}</p>}

          <section className="card">
            <BillAmounts invoice={invoice} />
            {invoice.note && <p className="muted small">{invoice.note}</p>}
            <p className="muted small">{t('bills.createdBy', { name: invoice.createdBy, date: formatDate(invoice.createdAt) })}</p>
          </section>

          <section className="card">
            <h2>{t('bills.payments')}</h2>
            <PaymentList payments={invoice.payments} onDelete={deletePayment} />
          </section>

          {invoice.open > 0 && <AddPayment invoice={invoice} onAdded={setInvoice} />}

          {editing && (
            <BillForm invoice={invoice} onClose={() => setEditing(false)}
              onSaved={(inv) => { setInvoice(inv); setEditing(false); }} />
          )}
        </>
      )}
    </div>
  );
}

function AddPayment({ invoice, onAdded }) {
  const { t, te } = useI18n();
  const [form, setForm] = useState({ amount: centsToInput(invoice.open), date: todayStr(), method: 'bank', note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // When the open amount changes (payment added or removed), suggest the new rest.
  useEffect(() => {
    setForm((f) => ({ ...f, amount: centsToInput(invoice.open) }));
  }, [invoice.open]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const amount = parseMoney(form.amount);
    if (!(amount > 0)) return setError(te('invalid_amount'));
    setBusy(true);
    try {
      const d = await api(`/admin/invoices/${invoice.id}/payments`, { method: 'POST', body: { ...form, amount } });
      setForm((f) => ({ ...f, note: '' }));
      onAdded(d.invoice);
    } catch (err) {
      setError(te(err.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>{t('bills.addPayment')}</h2>
      <div className="field-row even">
        <Field label={t('bills.amountEuro')} hint={t('bills.partialHint')}>
          <input required inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label={t('bills.paidOn')}>
          <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
      </div>
      <div className="segmented" role="group" aria-label={t('bills.methodLabel')}>
        {['bank', 'cash', 'other'].map((m) => (
          <button type="button" key={m} className={form.method === m ? 'active' : ''} aria-pressed={form.method === m}
            onClick={() => setForm({ ...form, method: m })}>
            {t(`bills.method.${m}`)}
          </button>
        ))}
      </div>
      <input value={form.note} maxLength={300} placeholder={t('bills.paymentNote')} aria-label={t('bills.paymentNote')}
        onChange={(e) => setForm({ ...form, note: e.target.value })} />
      <ErrorText>{error}</ErrorText>
      <button className="btn primary" disabled={busy}><Icon name="check" /> {t('bills.savePayment')}</button>
    </form>
  );
}
