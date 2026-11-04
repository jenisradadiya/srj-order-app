import { useRef, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { ErrorText, Icon } from '../ui.jsx';

// Warehouse notes for one order: items missing for this customer.
// Only SRJ (admin and warehouse) sees these; the customer does not.
export default function MissingItems({ order, onChange }) {
  const { t, te, formatDate } = useI18n();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const add = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    // Clear right away so the next note can be typed; put the text back if saving fails.
    setText('');
    setBusy(true);
    setError('');
    try {
      const { missing } = await api(`/team/orders/${order.id}/missing`, { method: 'POST', body: { text: value } });
      onChange(missing);
    } catch (err) {
      setText((current) => current || value);
      setError(te(err.code));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (note) => {
    if (!confirm(t('missing.deleteConfirm'))) return;
    try {
      const { missing } = await api(`/team/missing/${note.id}`, { method: 'DELETE' });
      onChange(missing);
    } catch (err) {
      setError(te(err.code));
    }
  };

  // Tapping an order line puts its name into the text field, ready to type after it.
  const prefill = (item) => {
    const value = `${item.name}${item.note ? ` (${item.note})` : ''}: `;
    setText(value);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(value.length, value.length);
    });
  };

  return (
    <section className="card missing-card">
      <h2>{t('missing.title')} {order.missing.length > 0 && <span className="badge status-warn">{order.missing.length}</span>}</h2>
      <p className="muted small">{t('missing.hint')}</p>

      {order.missing.length > 0 && (
        <ul className="plain-list note-list">
          {order.missing.map((m) => (
            <li key={m.id} className="note-row">
              <div>
                <strong>{m.text}</strong>
                <div className="muted small">{m.userName} · {formatDate(m.createdAt)}</div>
              </div>
              {(user.role === 'admin' || m.userId === user.id) && (
                <button className="icon-btn danger" onClick={() => remove(m)} aria-label={t('common.delete')}>
                  <Icon name="trash" size={18} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="stack" onSubmit={add}>
        {order.items.length > 0 && (
          <div className="chip-row" aria-label={t('missing.pickItem')}>
            {order.items.map((it) => (
              <button type="button" key={it.id} className="chip" onClick={() => prefill(it)}>{it.name}</button>
            ))}
          </div>
        )}
        <div className="inline-form">
          <input ref={input} value={text} maxLength={300} onChange={(e) => setText(e.target.value)}
            placeholder={t('missing.placeholder')} aria-label={t('missing.placeholder')} />
          <button className="btn primary" disabled={busy || !text.trim()}>
            <Icon name="plus" size={18} /> {t('common.add')}
          </button>
        </div>
        <ErrorText>{error}</ErrorText>
      </form>
    </section>
  );
}
