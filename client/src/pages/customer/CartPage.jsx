import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useDraft } from '../../lib/draft.jsx';
import { invalidateCatalog } from '../../lib/catalog.js';
import { ErrorText, Field, Icon } from '../../components/ui.jsx';
import { VoiceRecorder } from '../../components/Voice.jsx';
import { useFormatQty } from '../../components/OrderView.jsx';
import ItemSheet from '../../components/ItemSheet.jsx';

export default function CartPage() {
  const { t, te } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const formatQty = useFormatQty();
  const { draft, isEmpty, updateItem, removeItem, setField, reset, clear } = useDraft();
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    setError('');
    setSending(true);
    try {
      const { order } = await api('/orders', {
        method: 'POST',
        body: {
          clientRef: draft.ref,
          branchId: draft.branchId,
          note: draft.note,
          voiceId: draft.voice?.id ?? null,
          items: draft.items.map((it) => ({
            productId: it.productId,
            name: it.name,
            unit: it.unit,
            quantity: it.quantity,
            note: it.note,
            voiceId: it.voice?.id ?? null,
          })),
        },
      });
      reset();
      invalidateCatalog(); // "often ordered" changes
      navigate(`/orders/${order.id}?sent=1`, { replace: true });
    } catch (err) {
      setError(te(err.code));
      setSending(false);
    }
  };

  const clearAll = () => {
    if (confirm(t('cart.clearConfirm'))) clear();
  };

  return (
    <div className="page narrow">
      <Link to="/order" className="back-link">
        <Icon name="back" size={18} /> {t('cart.addMore')}
      </Link>
      <div className="section-head">
        <h1>{t('cart.title')}</h1>
        {!isEmpty && (
          <button className="btn small ghost danger" onClick={clearAll}>{t('cart.clear')}</button>
        )}
      </div>

      {user.branches.length > 1 && (
        <section className="card">
          <Field label={t('cart.deliverTo')}>
            <select value={draft.branchId ?? ''} onChange={(e) => setField('branchId', Number(e.target.value))}>
              {user.branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}{b.city && ` (${b.city})`}</option>
              ))}
            </select>
          </Field>
        </section>
      )}

      <section className="card">
        <h2>{t('cart.items', { count: draft.items.length })}</h2>
        {draft.items.length === 0 && (
          <p className="muted">
            {t('cart.empty')} <Link to="/order">{t('cart.toProducts')}</Link>
          </p>
        )}
        <ul className="plain-list">
          {draft.items.map((it) => (
            <li key={it.key}>
              <button className="cart-row" onClick={() => setEditing(it)}>
                <span className="item-qty">
                  {formatQty(it.quantity)}
                  {it.unit && <span className="muted small"> {it.unit}</span>}
                </span>
                <span className="item-body">
                  <strong>{it.name}</strong>
                  {!it.productId && <span className="badge">{t('order.customItem')}</span>}
                  {it.note && <span className="item-note">{it.note}</span>}
                  {it.voice && <span className="muted small"><Icon name="mic" size={14} /> {t('cart.hasVoice')}</span>}
                </span>
                <Icon name="edit" size={18} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h2>{t('cart.messageTitle')}</h2>
        <p className="muted small">{t('cart.messageHint')}</p>
        <textarea rows={3} maxLength={1000} value={draft.note} placeholder={t('cart.notePlaceholder')}
          aria-label={t('cart.messageTitle')} onChange={(e) => setField('note', e.target.value)} />
        <VoiceRecorder value={draft.voice} onChange={(v) => setField('voice', v)} />
      </section>

      <ErrorText>{error}</ErrorText>
      <button className="btn primary block big" disabled={isEmpty || sending} onClick={send}>
        <Icon name="send" /> {sending ? t('cart.sending') : t('cart.send')}
      </button>
      <p className="muted small center">{t('cart.sendHint')}</p>

      {editing && (
        <ItemSheet
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateItem(editing.key, patch);
            setEditing(null);
          }}
          onRemove={() => {
            removeItem(editing.key);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
