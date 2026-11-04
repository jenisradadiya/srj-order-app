import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { useDraft } from '../../lib/draft.jsx';
import { ErrorText, Icon, Spinner } from '../../components/ui.jsx';
import { OrderItems, OrderMessage, StatusBadge, StatusSteps } from '../../components/OrderView.jsx';

export default function OrderDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, te } = useI18n();
  const { isEmpty, loadFromOrder } = useDraft();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/orders/${id}`).then((d) => setOrder(d.order)).catch((err) => setError(te(err.code)));
  }, [id, te]);

  const orderAgain = () => {
    if (!isEmpty && !confirm(t('orders.replaceDraft'))) return;
    loadFromOrder(order);
    navigate('/order/cart');
  };

  return (
    <div className="page narrow">
      <Link to="/orders" className="back-link">
        <Icon name="back" size={18} /> {t('orders.title')}
      </Link>
      <ErrorText>{error}</ErrorText>
      {!order && !error && <Spinner />}
      {order && (
        <>
          {params.get('sent') === '1' && (
            <section className="card success-card" role="status">
              <Icon name="check" size={28} />
              <div>
                <strong>{t('orders.sentTitle')}</strong>
                <p>{t('orders.sentText')}</p>
              </div>
            </section>
          )}

          <div className="section-head">
            <h1>{t('orders.number', { id: order.id })}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="muted small">
            {order.branch.name} · {t('orders.by', { name: order.user.name })}
          </p>

          <section className="card">
            <StatusSteps order={order} />
          </section>

          <OrderMessage order={order} />

          <section className="card">
            <h2>{t('cart.items', { count: order.items.length })}</h2>
            <OrderItems items={order.items} />
          </section>

          <button className="btn block" onClick={orderAgain}>
            <Icon name="repeat" /> {t('orders.orderAgain')}
          </button>
          <p className="muted small center">{t('orders.orderAgainHint')}</p>
        </>
      )}
    </div>
  );
}
