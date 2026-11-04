import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { addDays, formatDay, isDateStr, mondayOf, todayStr, weekdayName } from '../../lib/dates.js';
import { ErrorText, Icon, Spinner } from '../../components/ui.jsx';

// Route overview: the calendar (real days) and the weekly plan (template).
export default function Routes() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'template' ? 'template' : 'calendar';

  return (
    <div className="page">
      <div className="section-head">
        <h1>{t('routes.title')}</h1>
        <Link className="btn small" to="/admin/day"><Icon name="list" size={16} /> {t('routes.dayView')}</Link>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={view === 'calendar'} className={view === 'calendar' ? 'active' : ''}
          onClick={() => setParams({})}>
          {t('routes.calendar')}
        </button>
        <button role="tab" aria-selected={view === 'template'} className={view === 'template' ? 'active' : ''}
          onClick={() => setParams({ view: 'template' })}>
          {t('routes.weeklyPlan')}
        </button>
      </div>
      {view === 'calendar' ? <Calendar /> : <WeeklyPlan />}
      <ReminderSettings />
    </div>
  );
}

// "Tomorrow is your delivery" – sent automatically the day before, at the set time.
function ReminderSettings() {
  const { t, te, lang } = useI18n();
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState({ error: '', ok: '' });
  const [busy, setBusy] = useState(false);
  const tomorrow = addDays(todayStr(), 1);

  useEffect(() => {
    api('/admin/reminders').then((d) => setSettings(d.settings)).catch((err) => setMessage({ error: te(err.code), ok: '' }));
  }, [te]);

  const run = async (fn) => {
    setBusy(true);
    setMessage({ error: '', ok: '' });
    try {
      setMessage({ error: '', ok: await fn() });
    } catch (err) {
      setMessage({ error: te(err.code), ok: '' });
    } finally {
      setBusy(false);
    }
  };

  const save = (next) =>
    run(async () => {
      const d = await api('/admin/reminders', { method: 'PUT', body: next });
      setSettings(d.settings);
      return t('plan.saved');
    });

  const sendNow = () =>
    confirm(t('reminders.sendConfirm', { day: formatDay(tomorrow, lang) })) &&
    run(async () => {
      const r = await api('/admin/reminders/send', { method: 'POST', body: { date: tomorrow } });
      return t('reminders.sent', r);
    });

  if (!settings) return <ErrorText>{message.error}</ErrorText>;
  return (
    <section className="card stack">
      <h2><Icon name="bell" /> {t('reminders.title')}</h2>
      <p className="muted small">{t('reminders.hint')}</p>
      <label className="check-row">
        <input type="checkbox" checked={settings.enabled} disabled={busy}
          onChange={(e) => save({ ...settings, enabled: e.target.checked })} />
        <span><strong>{t('reminders.enabled')}</strong></span>
      </label>
      <div className="inline-form">
        <label className="field grow">
          <span className="field-label">{t('reminders.time')}</span>
          <input type="time" value={settings.time} disabled={!settings.enabled || busy}
            onChange={(e) => setSettings({ ...settings, time: e.target.value })} />
        </label>
        <button className="btn align-end" disabled={busy} onClick={() => save(settings)}>{t('common.save')}</button>
      </div>
      <button className="btn small" disabled={busy} onClick={sendNow}>
        <Icon name="send" size={16} /> {t('reminders.sendNow')}
      </button>
      <ErrorText>{message.error}</ErrorText>
      {message.ok && <p className="success small" role="status">{message.ok}</p>}
    </section>
  );
}

function RouteSummary({ routes }) {
  const { t } = useI18n();
  if (routes.length === 0) return <p className="muted small">{t('routes.noRoutes')}</p>;
  return (
    <ul className="plain-list route-summary">
      {routes.map((r, i) => (
        <li key={i}>
          <strong>{r.name}</strong> <span className="muted">· {r.stops.length}</span>
          <div className="muted small clamp">{r.stops.map((s) => (typeof s === 'string' ? s : s.customerName)).join(', ')}</div>
        </li>
      ))}
    </ul>
  );
}

function Calendar() {
  const { t, te, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const start = isDateStr(params.get('week')) ? mondayOf(params.get('week')) : mondayOf(todayStr());
  const [days, setDays] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setDays(null);
    api(`/admin/routes/week?start=${start}`).then((d) => setDays(d.days)).catch((err) => setError(te(err.code)));
  }, [start, te]);

  const goWeek = (n) => setParams({ week: addDays(start, n * 7) });
  const end = addDays(start, 6);

  return (
    <>
      <div className="day-nav">
        <button className="icon-btn" onClick={() => goWeek(-1)} aria-label={t('routes.previousWeek')}><Icon name="back" /></button>
        <div className="day-title">
          <strong>{formatDay(start, lang, { day: 'numeric', month: 'short' })} – {formatDay(end, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
        </div>
        <button className="icon-btn" onClick={() => goWeek(1)} aria-label={t('routes.nextWeek')}><Icon name="chevron" /></button>
      </div>
      {start !== mondayOf(todayStr()) && (
        <button className="btn small" onClick={() => setParams({})}>{t('routes.thisWeek')}</button>
      )}
      <ErrorText>{error}</ErrorText>
      {!days && !error && <Spinner />}
      <div className="week-grid">
        {days?.map((d) => (
          <Link key={d.date} to={`/admin/routes/plan/d${d.date}`} className={`day-card ${d.date === todayStr() ? 'today' : ''}`}>
            <div className="day-card-head">
              <strong>{formatDay(d.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
              {d.custom && <span className="badge status-warn">{t('routes.changed')}</span>}
            </div>
            <RouteSummary routes={d.routes} />
          </Link>
        ))}
      </div>
      <p className="muted small">{t('routes.calendarHint')}</p>
    </>
  );
}

function WeeklyPlan() {
  const { t, te, lang } = useI18n();
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([1, 2, 3, 4, 5, 6, 7].map((n) => api(`/admin/routes/plan/w${n}`)))
      .then((list) => setPlans(list.map((d) => d.plan)))
      .catch((err) => setError(te(err.code)));
  }, [te]);

  return (
    <>
      <p className="muted small">{t('routes.weeklyHint')}</p>
      <ErrorText>{error}</ErrorText>
      {!plans && !error && <Spinner />}
      <div className="week-grid">
        {plans?.map((p) => (
          <Link key={p.key} to={`/admin/routes/plan/${p.key}`} className="day-card">
            <div className="day-card-head"><strong>{weekdayName(p.weekday, lang)}</strong></div>
            <RouteSummary routes={p.routes} />
          </Link>
        ))}
      </div>
    </>
  );
}
