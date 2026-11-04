import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { ErrorText, Icon, Spinner } from '../../components/ui.jsx';
import { StatusBadge } from '../../components/OrderView.jsx';

const TABS = ['sent', 'accepted', 'delivered', 'all'];
const PAGE = 50;

export default function Orders() {
  const { t, te, formatDate } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('status')) ? params.get('status') : 'sent';
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(
    async (offset = 0) => {
      const qs = new URLSearchParams({ limit: PAGE, offset });
      if (tab !== 'all') qs.set('status', tab);
      if (query.trim()) qs.set('q', query.trim());
      try {
        const next = await api(`/admin/orders?${qs}`);
        setError('');
        setData((prev) => (offset ? { ...next, orders: [...prev.orders, ...next.orders] } : next));
      } catch (err) {
        setError(te(err.code));
      }
    },
    [tab, query, te]
  );

  useEffect(() => {
    const timer = setTimeout(() => load(), 200);
    return () => clearTimeout(timer);
  }, [load]);

  // New orders arrive while the page is open: refresh every minute.
  useEffect(() => {
    const timer = setInterval(() => load(), 60000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="page">
      <div className="section-head">
        <h1>{t('adminOrders.title')}</h1>
        <button className="btn small" onClick={() => load()}>
          <Icon name="refresh" size={16} /> {t('common.refresh')}
        </button>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((s) => (
          <button key={s} role="tab" aria-selected={tab === s} className={tab === s ? 'active' : ''}
            onClick={() => setParams(s === 'sent' ? {} : { status: s })}>
            {s === 'all' ? t('adminOrders.all') : t(`orderStatus.${s}`)}
            {s !== 'all' && data?.counts && <span className="tab-count">{data.counts[s]}</span>}
          </button>
        ))}
      </div>

      <div className="search">
        <Icon name="search" />
        <input type="search" placeholder={t('adminOrders.search')} aria-label={t('adminOrders.search')}
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <ErrorText>{error}</ErrorText>
      {!data && !error && <Spinner />}
      {data?.orders.length === 0 && <p className="muted center">{t('adminOrders.empty')}</p>}

      <ul className="plain-list customer-list">
        {data?.orders.map((o) => (
          <li key={o.id}>
            <Link to={`/admin/orders/${o.id}`} className={`customer-card order-card status-line-${o.status}`}>
              <div>
                <div className="user-title">
                  <strong>#{o.id} · {o.customerName}</strong>
                  <StatusBadge status={o.status} />
                </div>
                <div className="muted small">
                  {o.branchName}{o.branchCity && ` (${o.branchCity})`} · {t('orders.by', { name: o.userName })}
                </div>
                <div className="muted small order-meta">
                  {formatDate(o.createdAt)} · {t('orders.itemCount', { count: o.itemCount })}
                  {o.hasVoice && <span title={t('adminOrders.hasVoice')}><Icon name="mic" size={14} /></span>}
                  {o.hasNote && <span title={t('adminOrders.hasNote')}><Icon name="note" size={14} /></span>}
                </div>
              </div>
              <Icon name="chevron" />
            </Link>
          </li>
        ))}
      </ul>
      {data && data.orders.length < data.total && (
        <button className="btn" onClick={() => load(data.orders.length)}>{t('common.loadMore')}</button>
      )}
    </div>
  );
}
