import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { ErrorText, Icon, Spinner, formatPhone } from '../../components/ui.jsx';
import { OrderItems, OrderMessage, StatusBadge, branchAddress } from '../../components/OrderView.jsx';
import MissingItems from '../../components/team/MissingItems.jsx';

// Warehouse view of one order: read-only, plus notes about missing items.
export default function TeamOrderDetail() {
  const { id } = useParams();
  const { t, te, formatDate } = useI18n();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/team/orders/${id}`).then((d) => setOrder(d.order)).catch((err) => setError(te(err.code)));
  }, [id, te]);

  return (
    <div className="page">
      <Link to="/warehouse/orders" className="back-link no-print">
        <Icon name="back" size={18} /> {t('adminOrders.title')}
      </Link>
      <ErrorText>{error}</ErrorText>
      {!order && !error && <Spinner />}
      {order && (
        <>
          <div className="section-head">
            <div>
              <h1>{t('orders.number', { id: order.id })} · {order.customer.name}</h1>
              <p className="muted small">
                {order.branch.name}
                {branchAddress(order.branch) && ` · ${branchAddress(order.branch)}`}
                {order.branch.phone && ` · ${formatPhone(order.branch.phone)}`}
              </p>
              <p className="muted small">{formatDate(order.createdAt)} · {t('orders.by', { name: order.user.name })}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <div className="order-actions no-print">
            <button className="btn" onClick={() => window.print()}>
              <Icon name="print" /> {t('adminOrders.print')}
            </button>
          </div>

          <OrderMessage order={order} />

          <section className="card">
            <h2>{t('cart.items', { count: order.items.length })}</h2>
            <OrderItems items={order.items} showCategory />
          </section>

          <div className="no-print">
            <MissingItems order={order} onChange={(missing) => setOrder({ ...order, missing })} />
          </div>
        </>
      )}
    </div>
  );
}
