import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { ErrorText, Icon, Spinner } from '../../components/ui.jsx';
import { StatusBadge } from '../../components/OrderView.jsx';

const PAGE = 30;

export default function OrdersPage() {
  const { t, te, formatDate } = useI18n();
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(
    async (offset = 0) => {
      try {
        const data = await api(`/orders?limit=${PAGE}&offset=${offset}`);
        setOrders((prev) => (offset ? [...prev, ...data.orders] : data.orders));
        setTotal(data.total);
      } catch (err) {
        setError(te(err.code));
      }
    },
    [te]
  );

  useEffect(() => {
    load();
  }, [load]);

  const multiBranch = user.branches.length > 1;

  return (
    <div className="page narrow">
      <h1>{t('orders.title')}</h1>
      <ErrorText>{error}</ErrorText>
      {!orders && !error && <Spinner />}
      {orders?.length === 0 && (
        <div className="card center stack">
          <p className="muted">{t('orders.empty')}</p>
          <Link to="/order" className="btn primary">{t('orders.firstOrder')}</Link>
        </div>
      )}
      <ul className="plain-list customer-list">
        {orders?.map((o) => (
          <li key={o.id}>
            <Link to={`/orders/${o.id}`} className="customer-card">
              <div>
                <div className="user-title">
                  <strong>#{o.id}</strong>
                  <StatusBadge status={o.status} />
                </div>
                <div className="muted small">
                  {formatDate(o.createdAt)} · {t('orders.itemCount', { count: o.itemCount })}
                  {multiBranch && ` · ${o.branchName}`}
                </div>
                <div className="muted small">{t('orders.by', { name: o.userName })}</div>
              </div>
              <Icon name="chevron" />
            </Link>
          </li>
        ))}
      </ul>
      {orders && orders.length < total && (
        <button className="btn" onClick={() => load(orders.length)}>{t('common.loadMore')}</button>
      )}
    </div>
  );
}
