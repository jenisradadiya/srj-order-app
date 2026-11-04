import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { ErrorText, Icon, Spinner } from '../ui.jsx';

// The shared "out of stock" list: items the whole warehouse has run out of.
export default function FinishedList() {
  const { t, te, formatDate } = useI18n();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(() => {
    api('/team/finished').then(setData).catch((err) => setError(te(err.code)));
  }, [te]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      load();
    } catch (err) {
      setError(te(err.code));
    }
  };

  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    run(async () => {
      await api('/team/finished', { method: 'POST', body: { text } });
      setText('');
    });
  };

  const canDelete = (item) => user.role === 'admin' || item.userId === user.id;

  return (
    <>
      <section className="card stack">
        <p className="muted small">{t('finished.hint')}</p>
        <form className="inline-form" onSubmit={add}>
          <input value={text} maxLength={200} onChange={(e) => setText(e.target.value)}
            placeholder={t('finished.placeholder')} aria-label={t('finished.placeholder')} />
          <button className="btn primary" disabled={!text.trim()}>
            <Icon name="plus" size={18} /> {t('common.add')}
          </button>
        </form>
        <ErrorText>{error}</ErrorText>
      </section>

      {!data && !error && <Spinner />}
      {data && (
        <section className="card">
          <h2>{t('finished.openTitle')} <span className="muted">({data.open.length})</span></h2>
          {data.open.length === 0 && <p className="muted">{t('finished.empty')}</p>}
          <ul className="plain-list note-list">
            {data.open.map((f) => (
              <li key={f.id} className="note-row">
                <div>
                  <strong>{f.text}</strong>
                  <div className="muted small">{f.userName} · {formatDate(f.createdAt)}</div>
                </div>
                <div className="row-actions">
                  <button className="btn small" onClick={() => run(() => api(`/team/finished/${f.id}/resolve`, { method: 'POST' }))}>
                    <Icon name="check" size={16} /> {t('finished.backInStock')}
                  </button>
                  {canDelete(f) && (
                    <button className="icon-btn danger" aria-label={t('common.delete')}
                      onClick={() => confirm(t('finished.deleteConfirm')) && run(() => api(`/team/finished/${f.id}`, { method: 'DELETE' }))}>
                      <Icon name="trash" size={18} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {data.resolved.length > 0 && (
            <>
              <button className="btn ghost small" onClick={() => setShowHistory(!showHistory)}>
                {showHistory ? t('finished.hideHistory') : t('finished.showHistory', { count: data.resolved.length })}
              </button>
              {showHistory && (
                <ul className="plain-list note-list resolved">
                  {data.resolved.map((f) => (
                    <li key={f.id} className="note-row">
                      <div>
                        <span>{f.text}</span>
                        <div className="muted small">{t('finished.resolvedBy', { name: f.resolvedBy, date: formatDate(f.resolvedAt) })}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
