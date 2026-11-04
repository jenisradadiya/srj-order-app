import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { addDays, formatDay, isDateStr, todayStr } from '../../lib/dates.js';
import { ErrorText, Icon, Spinner } from '../../components/ui.jsx';
import { StatusBadge } from '../../components/OrderView.jsx';

// "What goes out on this day": the day's routes, their stops in order,
// and each stop's open orders. Used by the warehouse and the admin.
export default function DayView() {
  const { t, te, lang } = useI18n();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const date = isDateStr(params.get('date')) ? params.get('date') : todayStr();
  const [day, setDay] = useState(null);
  const [error, setError] = useState('');

  const orderPath = user.role === 'admin' ? '/admin/orders' : '/warehouse/orders';
  const setDate = (d) => setParams(d === todayStr() ? {} : { date: d });

  useEffect(() => {
    let cancelled = false;
    setDay(null);
    setError('');
    api(`/team/day?date=${date}`)
      .then((d) => !cancelled && setDay(d))
      .catch((err) => !cancelled && setError(te(err.code)));
    return () => {
      cancelled = true;
    };
  }, [date, te]);

  const relative =
    date === todayStr() ? t('day.today') : date === addDays(todayStr(), 1) ? t('day.tomorrow') : null;
  const orderCount = day ? day.routes.reduce((n, r) => n + r.stops.reduce((m, s) => m + s.orders.length, 0), 0) : 0;

  return (
    <div className="page">
      <div className="day-nav">
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label={t('day.previous')}>
          <Icon name="back" />
        </button>
        <div className="day-title">
          <h1>{relative ?? formatDay(date, lang)}</h1>
          <span className="muted small">{relative ? formatDay(date, lang) : ''}</span>
        </div>
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label={t('day.next')}>
          <Icon name="chevron" />
        </button>
      </div>
      <div className="row-actions">
        {date !== todayStr() && <button className="btn small" onClick={() => setDate(todayStr())}>{t('day.today')}</button>}
        {user.role === 'admin' && (
          <Link className="btn small" to={`/admin/routes/plan/d${date}`}>
            <Icon name="edit" size={16} /> {t('day.editRoutes')}
          </Link>
        )}
      </div>

      <ErrorText>{error}</ErrorText>
      {!day && !error && <Spinner />}

      {day && (
        <>
          <p className="muted">
            {t('day.summary', { routes: day.routes.length, orders: orderCount })}
            {day.custom && <> · <span className="badge status-warn">{t('routes.changed')}</span></>}
          </p>
          {day.routes.length === 0 && <div className="card muted">{t('day.noRoutes')}</div>}

          {day.routes.map((route) => (
            <section key={route.id} className="card route-card">
              <h2><Icon name="pin" /> {route.name} <span className="muted">· {t('day.stops', { count: route.stops.length })}</span></h2>
              <ol className="stop-list">
                {route.stops.map((s, i) => (
                  <li key={s.branchId} className="stop-row">
                    <span className="stop-number">{i + 1}</span>
                    <div className="grow">
                      <strong>{s.customerName}</strong>
                      {s.branchName !== s.customerName && <span> · {s.branchName}</span>}
                      <div className="muted small">{[s.street, s.city].filter(Boolean).join(', ')}</div>
                      {s.orders.length === 0 && <div className="muted small">{t('day.noOrder')}</div>}
                      {s.orders.map((o) => <OrderChip key={o.id} order={o} to={`${orderPath}/${o.id}`} />)}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          {day.otherOrders.length > 0 && (
            <section className="card">
              <h2>{t('day.otherOrders')}</h2>
              <p className="muted small">{t('day.otherOrdersHint')}</p>
              {day.otherOrders.map((o) => (
                <OrderChip key={o.id} order={o} to={`${orderPath}/${o.id}`} showCustomer />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function OrderChip({ order, to, showCustomer }) {
  const { t, formatDate } = useI18n();
  return (
    <Link to={to} className="order-chip">
      <strong>#{order.id}</strong>
      {showCustomer && <span>{order.customerName}</span>}
      <StatusBadge status={order.status} />
      <span className="muted small">{t('orders.itemCount', { count: order.itemCount })} · {formatDate(order.createdAt)}</span>
      {order.hasVoice && <Icon name="mic" size={14} />}
      {order.missingCount > 0 && <span className="badge status-warn">{t('missing.count', { count: order.missingCount })}</span>}
    </Link>
  );
}
