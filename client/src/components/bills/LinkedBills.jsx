import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { formatDay } from '../../lib/dates.js';
import { Icon } from '../ui.jsx';
import { BillForm, BillStatus, useMoney } from './BillParts.jsx';

// Admin: the bills of one customer, or of one order, with an "add bill" button.
// filter = { customerId } or { orderId }; prefill = values for a new bill.
export default function LinkedBills({ filter, prefill, title, limit = 5 }) {
  const { t, lang } = useI18n();
  const money = useMoney();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);

  const query = new URLSearchParams({ ...filter, status: 'all', limit }).toString();
  const load = useCallback(() => {
    api(`/admin/invoices?${query}`).then(setData).catch(() => setData(null));
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="card">
      <div className="section-head">
        <h2>{title}</h2>
        <button className="btn primary small" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> {t('bills.add')}
        </button>
      </div>
      {data && data.totals.count > 0 && filter.customerId && (
        <p className="muted small">
          {t('bills.openOfTotal', { open: money(data.totals.open), count: data.totals.openCount, total: data.totals.count })}
        </p>
      )}
      {data && data.invoices.length === 0 && <p className="muted">{t('bills.noneYet')}</p>}
      <ul className="plain-list note-list">
        {data?.invoices.map((inv) => (
          <li key={inv.id}>
            <Link to={`/admin/bills/${inv.id}`} className="note-row link-row">
              <span>
                <strong>{inv.number}</strong> <BillStatus status={inv.status} />
                <span className="muted small block">{formatDay(inv.date, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </span>
              <strong>{money(inv.amount)}</strong>
            </Link>
          </li>
        ))}
      </ul>
      {data && filter.customerId && data.totals.count > data.invoices.length && (
        <Link to={`/admin/bills?customerId=${filter.customerId}&status=all`} className="btn small">{t('bills.showAllCount', { count: data.totals.count })}</Link>
      )}
      {adding && (
        <BillForm prefill={prefill} onClose={() => setAdding(false)} onSaved={(inv) => navigate(`/admin/bills/${inv.id}`)} />
      )}
    </section>
  );
}
