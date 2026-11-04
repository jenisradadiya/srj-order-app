import { useI18n } from '../i18n/index.jsx';
import { Icon } from './ui.jsx';
import { VoicePlayer } from './Voice.jsx';

const LOCALES = { de: 'de-DE', en: 'en-GB', hi: 'hi-IN' };

export function useFormatQty() {
  const { lang } = useI18n();
  return (q) => new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: 2 }).format(q);
}

export function StatusBadge({ status }) {
  const { t } = useI18n();
  return <span className={`badge status-${status}`}>{t(`orderStatus.${status}`)}</span>;
}

export const branchAddress = (b) =>
  [b.street, [b.postalCode, b.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

// Sent -> accepted -> delivered, with the time of each step.
export function StatusSteps({ order }) {
  const { t, formatDate } = useI18n();
  const steps = [
    { key: 'sent', at: order.createdAt },
    { key: 'accepted', at: order.acceptedAt },
    { key: 'delivered', at: order.deliveredAt },
  ];
  return (
    <ol className="status-steps">
      {steps.map((s) => (
        <li key={s.key} className={s.at ? 'done' : ''}>
          <span className="step-dot" aria-hidden="true">{s.at && <Icon name="check" size={14} />}</span>
          <span>
            <strong>{t(`orderStatus.${s.key}`)}</strong>
            {s.at && <span className="muted small"> · {formatDate(s.at)}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

// Order-level note and voice message, shown prominently.
export function OrderMessage({ order }) {
  const { t } = useI18n();
  if (!order.note && !order.voice) return null;
  return (
    <section className="card order-message">
      <h2>{t('order.messageTitle')}</h2>
      {order.note && <p className="pre-line">{order.note}</p>}
      <VoicePlayer voice={order.voice} />
    </section>
  );
}

export function OrderItems({ items, showCategory = false }) {
  const { t } = useI18n();
  const formatQty = useFormatQty();
  if (items.length === 0) return <p className="muted">{t('order.noItems')}</p>;
  return (
    <ol className="order-items">
      {items.map((it, i) => (
        <li key={it.id ?? it.key} className="order-item">
          <span className="item-pos muted">{i + 1}</span>
          <span className="item-qty">
            {formatQty(it.quantity)}
            {it.unit && <span className="muted small"> {it.unit}</span>}
          </span>
          <div className="item-body">
            <div className="item-name">
              <strong>{it.name}</strong>
              {it.isCustom && <span className="badge">{t('order.customItem')}</span>}
              {showCategory && it.categoryName && <span className="muted small">{it.categoryName}</span>}
            </div>
            {it.note && <p className="item-note">{it.note}</p>}
            <VoicePlayer voice={it.voice} />
          </div>
        </li>
      ))}
    </ol>
  );
}
