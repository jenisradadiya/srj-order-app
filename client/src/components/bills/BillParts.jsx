import { useEffect, useState } from 'react';
import { api, uploadPdf } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { centsToInput, formatMoney, parseMoney } from '../../lib/money.js';
import { formatDay, todayStr } from '../../lib/dates.js';
import { ErrorText, Field, Icon, Modal } from '../ui.jsx';

export function BillStatus({ status }) {
  const { t } = useI18n();
  return <span className={`badge bill-${status}`}>{t(`bills.status.${status}`)}</span>;
}

export function useMoney() {
  const { lang } = useI18n();
  return (cents) => formatMoney(cents, lang);
}

// Amount / paid / open with a small progress bar.
export function BillAmounts({ invoice }) {
  const { t } = useI18n();
  const money = useMoney();
  const percent = Math.min(100, Math.round((invoice.paid / invoice.amount) * 100));
  return (
    <div className="bill-amounts">
      <div><span className="muted small">{t('bills.amount')}</span><strong>{money(invoice.amount)}</strong></div>
      <div><span className="muted small">{t('bills.paid')}</span><strong className="paid-text">{money(invoice.paid)}</strong></div>
      <div><span className="muted small">{t('bills.open')}</span><strong className={invoice.open ? 'open-text' : ''}>{money(invoice.open)}</strong></div>
      <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function PaymentList({ payments, onDelete }) {
  const { t, lang } = useI18n();
  const money = useMoney();
  if (payments.length === 0) return <p className="muted">{t('bills.noPayments')}</p>;
  return (
    <ul className="plain-list note-list">
      {payments.map((p) => (
        <li key={p.id} className="note-row">
          <div>
            <strong>{money(p.amount)}</strong> <span className="badge">{t(`bills.method.${p.method}`)}</span>
            <div className="muted small">
              {formatDay(p.date, lang, { day: 'numeric', month: 'short', year: 'numeric' })}
              {p.note && ` · ${p.note}`}
              {p.createdBy && ` · ${t('bills.recordedBy', { name: p.createdBy })}`}
            </div>
          </div>
          {onDelete && (
            <button className="icon-btn danger" onClick={() => onDelete(p)} aria-label={t('common.delete')}>
              <Icon name="trash" size={18} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// Add or edit a bill. `prefill` can preset customerId / branchId / orderId (e.g. from an order).
export function BillForm({ invoice, prefill = {}, onClose, onSaved }) {
  const { t, te, formatDate } = useI18n();
  const [customers, setCustomers] = useState([]);
  const [detail, setDetail] = useState(null); // branches of the chosen customer
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({
    customerId: invoice?.customerId ?? prefill.customerId ?? '',
    branchId: invoice?.branchId ?? prefill.branchId ?? '',
    orderId: invoice?.orderId ?? prefill.orderId ?? '',
    number: invoice?.number ?? '',
    date: invoice?.date ?? todayStr(),
    amount: centsToInput(invoice?.amount),
    note: invoice?.note ?? '',
  });
  const [file, setFile] = useState(null); // { fileId, fileName } once uploaded
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    api('/admin/customers').then((d) => setCustomers(d.customers)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.customerId) {
      setDetail(null);
      setOrders([]);
      return;
    }
    api(`/admin/customers/${form.customerId}`).then(setDetail).catch(() => setDetail(null));
    api(`/admin/orders?customerId=${form.customerId}&limit=30`).then((d) => setOrders(d.orders)).catch(() => setOrders([]));
  }, [form.customerId]);

  const changeCustomer = (e) => setForm((f) => ({ ...f, customerId: e.target.value, branchId: '', orderId: '' }));

  // Picking an order also picks its branch.
  const changeOrder = (e) => {
    const order = orders.find((o) => String(o.id) === e.target.value);
    setForm((f) => ({ ...f, orderId: e.target.value, branchId: order ? order.branchId : f.branchId }));
  };

  const pickFile = async (e) => {
    const chosen = e.target.files?.[0];
    e.target.value = '';
    if (!chosen) return;
    setError('');
    if (chosen.type && chosen.type !== 'application/pdf') return setError(te('pdf_invalid'));
    setUploading(true);
    try {
      const { fileId } = await uploadPdf(chosen);
      setFile({ fileId, fileName: chosen.name });
      // Fill in the bill number from a file name like "RE-2026-0042.pdf", if still empty.
      if (!form.number) setForm((f) => ({ ...f, number: chosen.name.replace(/\.pdf$/i, '') }));
    } catch (err) {
      setError(te(err.code));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const amount = parseMoney(form.amount);
    if (!(amount > 0)) return setError(te('invalid_amount'));
    setBusy(true);
    const body = {
      customerId: Number(form.customerId),
      branchId: form.branchId ? Number(form.branchId) : null,
      orderId: form.orderId ? Number(form.orderId) : null,
      number: form.number,
      date: form.date,
      amount,
      note: form.note,
      ...(file && { fileId: file.fileId, fileName: file.fileName }),
    };
    try {
      const { invoice: saved } = invoice
        ? await api(`/admin/invoices/${invoice.id}`, { method: 'PATCH', body })
        : await api('/admin/invoices', { method: 'POST', body });
      onSaved(saved);
    } catch (err) {
      setError(te(err.code));
      setBusy(false);
    }
  };

  return (
    <Modal title={invoice ? t('bills.edit') : t('bills.add')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="pdf-drop">
          <Icon name="note" />
          <div className="grow">
            <strong>{file ? file.fileName : invoice?.hasFile ? invoice.fileName : t('bills.noFile')}</strong>
            <div className="muted small">{uploading ? t('bills.uploading') : t('bills.pdfHint')}</div>
          </div>
          <label className="btn small file-btn">
            <Icon name="upload" size={16} /> {file || invoice?.hasFile ? t('bills.replacePdf') : t('bills.choosePdf')}
            <input type="file" accept="application/pdf,.pdf" onChange={pickFile} />
          </label>
        </div>

        <Field label={t('bills.customer')}>
          <select required value={form.customerId} onChange={changeCustomer}>
            <option value="">{t('bills.chooseCustomer')}</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {detail && (
          <div className="field-row even">
            <Field label={`${t('fields.branch')} (${t('common.optional')})`}>
              <select value={form.branchId} onChange={set('branchId')}>
                <option value="">—</option>
                {detail.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label={`${t('bills.order')} (${t('common.optional')})`}>
              <select value={form.orderId} onChange={changeOrder}>
                <option value="">—</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>#{o.id} · {formatDate(o.createdAt, false)} · {o.branchName}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <div className="field-row even">
          <Field label={t('bills.number')}>
            <input required value={form.number} onChange={set('number')} placeholder="RE-2026-0001" />
          </Field>
          <Field label={t('bills.date')}>
            <input required type="date" value={form.date} onChange={set('date')} />
          </Field>
        </div>
        <Field label={t('bills.amountEuro')}>
          <input required inputMode="decimal" value={form.amount} onChange={set('amount')} placeholder="1234,56" />
        </Field>
        <Field label={`${t('fields.notes')} (${t('common.optional')})`}>
          <input value={form.note} maxLength={500} onChange={set('note')} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={busy || uploading}>{t('common.save')}</button>
        </div>
      </form>
    </Modal>
  );
}
