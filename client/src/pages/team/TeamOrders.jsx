import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { ErrorText, Icon, Spinner } from '../../components/ui.jsx';
import { StatusBadge } from '../../components/OrderView.jsx';

const TABS = ['open', 'delivered'];
const PAGE = 50;

// Warehouse: all orders to prepare (open) and the ones already delivered.
export default function TeamOrders() {
  const { t, te, formatDate } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('status')) ? params.get('status') : 'open';
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(
    async (offset = 0) => {
      const qs = new URLSearchParams({ status: tab, limit: PAGE, offset });
      if (query.trim()) qs.set('q', query.trim());
      try {
        const next = await api(`/team/orders?${qs}`);
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
    const refresh = setInterval(() => load(), 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(refresh);
    };
  }, [load]);

  return (
    <div className="page">
      <h1>{t('adminOrders.title')}</h1>
      <div className="tabs" role="tablist">
        {TABS.map((s) => (
          <button key={s} role="tab" aria-selected={tab === s} className={tab === s ? 'active' : ''}
            onClick={() => setParams(s === 'open' ? {} : { status: s })}>
            {t(`teamOrders.${s}`)}
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
            <Link to={`/warehouse/orders/${o.id}`} className={`customer-card order-card status-line-${o.status}`}>
              <div>
                <div className="user-title">
                  <strong>#{o.id} · {o.customerName}</strong>
                  <StatusBadge status={o.status} />
                  {o.missingCount > 0 && <span className="badge status-warn">{t('missing.count', { count: o.missingCount })}</span>}
                </div>
                <div className="muted small">{o.branchName}{o.branchCity && ` (${o.branchCity})`}</div>
                <div className="muted small order-meta">
                  {formatDate(o.createdAt)} · {t('orders.itemCount', { count: o.itemCount })}
                  {o.hasVoice && <Icon name="mic" size={14} />}
                  {o.hasNote && <Icon name="note" size={14} />}
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
