import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { ErrorText, Icon, Spinner, formatPhone } from '../../components/ui.jsx';
import { OrderItems, OrderMessage, StatusBadge, StatusSteps, branchAddress } from '../../components/OrderView.jsx';
import MissingItems from '../../components/team/MissingItems.jsx';
import LinkedBills from '../../components/bills/LinkedBills.jsx';

export default function OrderDetail() {
  const { id } = useParams();
  const { t, te, formatDate } = useI18n();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/admin/orders/${id}`).then((d) => setOrder(d.order)).catch((err) => setError(te(err.code)));
  }, [id, te]);

  const setStatus = async (status) => {
    setBusy(true);
    setError('');
    try {
      const d = await api(`/admin/orders/${order.id}/status`, { method: 'POST', body: { status } });
      setOrder(d.order);
    } catch (err) {
      setError(te(err.code));
    } finally {
      setBusy(false);
    }
  };

  const undo = () => {
    const previous = order.status === 'delivered' ? 'accepted' : 'sent';
    if (confirm(t('adminOrders.undoConfirm', { status: t(`orderStatus.${previous}`) }))) setStatus(previous);
  };

  return (
    <div className="page">
      <Link to="/admin/orders" className="back-link no-print">
        <Icon name="back" size={18} /> {t('adminOrders.title')}
      </Link>
      <ErrorText>{error}</ErrorText>
      {!order && !error && <Spinner />}
      {order && (
        <>
          <div className="section-head">
            <div>
              <h1>{t('orders.number', { id: order.id })} · {order.customer.name}</h1>
              <p className="muted small">{formatDate(order.createdAt)}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          <div className="order-actions no-print">
            {order.status === 'sent' && (
              <button className="btn primary big" disabled={busy} onClick={() => setStatus('accepted')}>
                <Icon name="check" /> {t('adminOrders.accept')}
              </button>
            )}
            {order.status === 'accepted' && (
              <button className="btn primary big" disabled={busy} onClick={() => setStatus('delivered')}>
                <Icon name="check" /> {t('adminOrders.markDelivered')}
              </button>
            )}
            <button className="btn" onClick={() => window.print()}>
              <Icon name="print" /> {t('adminOrders.print')}
            </button>
            {order.status !== 'sent' && (
              <button className="btn ghost small" disabled={busy} onClick={undo}>{t('adminOrders.undo')}</button>
            )}
          </div>

          <div className="detail-grid">
            <section className="card">
              <h2>{t('adminOrders.deliverTo')}</h2>
              <p className="tight">
                <Link to={`/admin/customers/${order.customer.id}`}><strong>{order.customer.name}</strong></Link>
                <br />
                {order.branch.name}
                {branchAddress(order.branch) && <><br />{branchAddress(order.branch)}</>}
                {order.branch.phone && <><br />{formatPhone(order.branch.phone)}</>}
              </p>
              <p className="muted small">
                {t('orders.by', { name: order.user.name })} ({t(`roles.${order.user.role}`)})
                {order.acceptedBy && <><br />{t('adminOrders.acceptedBy', { name: order.acceptedBy })}</>}
              </p>
            </section>
            <section className="card no-print">
              <StatusSteps order={order} />
            </section>
          </div>

          <OrderMessage order={order} />

          <section className="card">
            <h2>{t('cart.items', { count: order.items.length })}</h2>
            <OrderItems items={order.items} showCategory />
          </section>

          <div className="no-print stack">
            <MissingItems order={order} onChange={(missing) => setOrder({ ...order, missing })} />
            <LinkedBills title={t('bills.forOrder')} filter={{ orderId: order.id }}
              prefill={{ customerId: order.customer.id, branchId: order.branch.id, orderId: order.id }} />
          </div>
        </>
      )}
    </div>
  );
}
