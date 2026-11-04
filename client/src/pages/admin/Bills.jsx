import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { formatDay } from '../../lib/dates.js';
import { ErrorText, Icon, Spinner } from '../../components/ui.jsx';
import { BillForm, BillStatus, useMoney } from '../../components/bills/BillParts.jsx';

const TABS = ['open', 'paid', 'all'];
const PAGE = 100;

export default function Bills() {
  const { t, te, lang } = useI18n();
  const money = useMoney();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('status')) ? params.get('status') : 'open';
  const customerId = params.get('customerId') || '';
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(params.get('new') === '1');

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const load = useCallback(
    async (offset = 0) => {
      const qs = new URLSearchParams({ status: tab, limit: PAGE, offset });
      if (customerId) qs.set('customerId', customerId);
      if (query.trim()) qs.set('q', query.trim());
      try {
        const next = await api(`/admin/invoices?${qs}`);
        setError('');
        setData((prev) => (offset ? { ...next, invoices: [...prev.invoices, ...next.invoices] } : next));
      } catch (err) {
        setError(te(err.code));
      }
    },
    [tab, customerId, query, te]
  );

  useEffect(() => {
    const timer = setTimeout(() => load(), 200);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!customerId) return setCustomerName('');
    api(`/admin/customers/${customerId}`).then((d) => setCustomerName(d.customer.name)).catch(() => setCustomerName(''));
  }, [customerId]);

  return (
    <div className="page">
      <div className="section-head">
        <h1>{t('bills.title')}</h1>
        <button className="btn primary small" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> {t('bills.add')}
        </button>
      </div>

      {customerId && (
        <div className="filter-chip">
          {t('bills.onlyCustomer', { name: customerName || '…' })}
          <button className="icon-btn small" onClick={() => setParam('customerId', '')} aria-label={t('bills.showAll')}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {data && (
        <div className="stat-grid totals">
          <div className="stat highlight"><span className="stat-value">{money(data.totals.open)}</span><span className="stat-label">{t('bills.totalOpen')}</span></div>
          <div className="stat"><span className="stat-value">{data.totals.count}</span><span className="stat-label">{t('bills.count')}</span></div>
          <div className="stat"><span className="stat-value small-value">{money(data.totals.amount)}</span><span className="stat-label">{t('bills.totalAmount')}</span></div>
        </div>
      )}

      <div className="tabs" role="tablist">
        {TABS.map((s) => (
          <button key={s} role="tab" aria-selected={tab === s} className={tab === s ? 'active' : ''}
            onClick={() => setParam('status', s === 'open' ? '' : s)}>
            {t(`bills.tab.${s}`)}
          </button>
        ))}
      </div>
      <div className="search">
        <Icon name="search" />
        <input type="search" placeholder={t('bills.search')} aria-label={t('bills.search')}
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <ErrorText>{error}</ErrorText>
      {!data && !error && <Spinner />}
      {data?.invoices.length === 0 && <p className="muted center">{t('bills.empty')}</p>}
      <ul className="plain-list customer-list">
        {data?.invoices.map((inv) => (
          <li key={inv.id}>
            <Link to={`/admin/bills/${inv.id}`} className={`customer-card bill-card bill-line-${inv.status}`}>
              <div className="grow">
                <div className="user-title">
                  <strong>{inv.number}</strong>
                  <BillStatus status={inv.status} />
                  {!inv.hasFile && <span className="badge">{t('bills.noPdf')}</span>}
                </div>
                <div className="muted small">
                  {inv.customerName}{inv.branchName && inv.branchName !== inv.customerName && ` · ${inv.branchName}`}
                  {' · '}{formatDay(inv.date, lang, { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div className="bill-money">
                <strong>{money(inv.amount)}</strong>
                {inv.status === 'partial' && <span className="muted small">{t('bills.openAmount', { amount: money(inv.open) })}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {data && data.invoices.length < data.totals.count && (
        <button className="btn" onClick={() => load(data.invoices.length)}>{t('common.loadMore')}</button>
      )}

      {adding && (
        <BillForm prefill={{ customerId }} onClose={() => setAdding(false)}
          onSaved={(inv) => navigate(`/admin/bills/${inv.id}`)} />
      )}
    </div>
  );
}
