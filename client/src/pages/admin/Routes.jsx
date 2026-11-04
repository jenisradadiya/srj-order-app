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
    </div>
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
