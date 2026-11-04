import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { formatDay, weekdayName } from '../../lib/dates.js';
import { ErrorText, Icon, Spinner } from '../../components/ui.jsx';

const POOL = 'pool';
const itemId = (branchId) => `b${branchId}`;
const branchIdOf = (id) => Number(id.slice(1));
let routeSeq = 0;
const newRouteKey = () => `r${++routeSeq}`;

// Plan one day (or one weekday of the template): drag restaurants from the
// list on the left into routes, and drag within a route to set the order.
export default function PlanEditor() {
  const { key } = useParams();
  const { t, te, lang } = useI18n();
  const [branches, setBranches] = useState(null); // Map id -> branch
  const [plan, setPlan] = useState(null);
  const [routes, setRoutes] = useState([]); // [{ key, name }]
  const [items, setItems] = useState({}); // { pool: [...], r1: [...] }
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const isDay = key.startsWith('d');
  const date = isDay ? key.slice(1) : null;

  const apply = useCallback((p, branchMap) => {
    const nextRoutes = p.routes.map((r) => ({ key: newRouteKey(), name: r.name }));
    const next = { [POOL]: [] };
    const used = new Set();
    p.routes.forEach((r, i) => {
      next[nextRoutes[i].key] = r.stops.map((s) => {
        used.add(s.branchId);
        return itemId(s.branchId);
      });
    });
    next[POOL] = [...branchMap.keys()].filter((id) => !used.has(id)).map(itemId);
    setPlan(p);
    setRoutes(nextRoutes);
    setItems(next);
    setSaved(JSON.stringify(serialize(nextRoutes, next)));
  }, []);

  useEffect(() => {
    Promise.all([api('/admin/routes/branches'), api(`/admin/routes/plan/${key}`)])
      .then(([b, p]) => {
        const map = new Map(b.branches.map((x) => [x.id, x]));
        setBranches(map);
        apply(p.plan, map);
      })
      .catch((err) => setError(te(err.code)));
  }, [key, te, apply]);

  const current = JSON.stringify(serialize(routes, items));
  const dirty = Boolean(saved) && current !== saved;

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const { plan: p } = await api(`/admin/routes/plan/${key}`, { method: 'PUT', body: { routes: serialize(routes, items) } });
      apply(p, branches);
      setNotice(t('plan.saved'));
      setTimeout(() => setNotice(''), 2500);
    } catch (err) {
      setError(te(err.code));
    } finally {
      setBusy(false);
    }
  };

  const resetToTemplate = async () => {
    if (!confirm(t('plan.resetConfirm'))) return;
    try {
      const { plan: p } = await api(`/admin/routes/plan/${key}`, { method: 'DELETE' });
      apply(p, branches);
    } catch (err) {
      setError(te(err.code));
    }
  };

  const addRoute = () => {
    const k = newRouteKey();
    setRoutes((r) => [...r, { key: k, name: `${t('plan.route')} ${r.length + 1}` }]);
    setItems((it) => ({ ...it, [k]: [] }));
  };

  const removeRoute = (k) => {
    if (items[k].length && !confirm(t('plan.removeRouteConfirm'))) return;
    setRoutes((r) => r.filter((x) => x.key !== k));
    setItems((it) => {
      const { [k]: removed, ...rest } = it;
      return { ...rest, [POOL]: [...rest[POOL], ...removed] };
    });
  };

  const moveTo = (id, to) =>
    setItems((it) => {
      const from = Object.keys(it).find((k) => it[k].includes(id));
      if (!from || from === to) return it;
      return { ...it, [from]: it[from].filter((x) => x !== id), [to]: [...it[to], id] };
    });

  if (!branches || !plan) {
    return (
      <div className="page">
        <BackLink />
        <ErrorText>{error}</ErrorText>
        {!error && <Spinner />}
      </div>
    );
  }

  const title = isDay ? formatDay(date, lang) : `${t('routes.weeklyPlan')} – ${weekdayName(Number(key.slice(1)), lang)}`;

  return (
    <div className="page wide">
      <BackLink />
      <div className="section-head">
        <div>
          <h1>{title}</h1>
          {isDay && (
            <p className="muted small">
              {plan.custom ? t('plan.customDay') : t('plan.followsTemplate', { weekday: weekdayName(plan.weekday, lang) })}
            </p>
          )}
          {!isDay && <p className="muted small">{t('plan.templateHint')}</p>}
        </div>
        <div className="row-actions">
          {isDay && <Link className="btn small" to={`/admin/day?date=${date}`}><Icon name="list" size={16} /> {t('routes.dayView')}</Link>}
          {isDay && plan.custom && (
            <button className="btn small" onClick={resetToTemplate}><Icon name="repeat" size={16} /> {t('plan.reset')}</button>
          )}
        </div>
      </div>

      <ErrorText>{error}</ErrorText>

      <Board routes={routes} setRoutes={setRoutes} items={items} setItems={setItems} branches={branches}
        onAddRoute={addRoute} onRemoveRoute={removeRoute} onMoveTo={moveTo} />

      <div className={`save-bar ${dirty || notice ? 'visible' : ''}`}>
        {notice ? (
          <span><Icon name="check" size={18} /> {notice}</span>
        ) : (
          <>
            <span>{isDay && !plan.custom ? t('plan.unsavedDay') : t('plan.unsaved')}</span>
            <button className="btn small ghost light" onClick={() => apply(plan, branches)}>{t('plan.discard')}</button>
            <button className="btn small light-primary" disabled={busy} onClick={save}>{t('common.save')}</button>
          </>
        )}
      </div>
    </div>
  );
}

function serialize(routes, items) {
  return routes.map((r) => ({ name: r.name.trim(), branchIds: (items[r.key] || []).map(branchIdOf) }));
}

function BackLink() {
  const { t } = useI18n();
  return (
    <Link to="/admin/routes" className="back-link">
      <Icon name="back" size={18} /> {t('routes.title')}
    </Link>
  );
}

function Board({ routes, setRoutes, items, setItems, branches, onAddRoute, onRemoveRoute, onMoveTo }) {
  const { t } = useI18n();
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const branchOf = (id) => branches.get(branchIdOf(id));
  const findContainer = (id) => (id in items ? id : Object.keys(items).find((k) => items[k].includes(id)));

  // The pool is always shown alphabetically and filtered by the search.
  const poolShown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items[POOL]
      .filter((id) => {
        const b = branchOf(id);
        return !q || `${b.customerName} ${b.branchName} ${b.city}`.toLowerCase().includes(q);
      })
      .sort((a, b) => branchOf(a).customerName.localeCompare(branchOf(b).customerName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, branches]);

  const onDragOver = ({ active, over }) => {
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (!from || !to || from === to) return;
    setItems((prev) => {
      const toItems = prev[to].filter((x) => x !== active.id);
      const overIndex = toItems.indexOf(over.id);
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, active.id);
      return { ...prev, [from]: prev[from].filter((x) => x !== active.id), [to]: toItems };
    });
  };

  const onDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (from && from === to && from !== POOL) {
      const oldIndex = items[from].indexOf(active.id);
      const newIndex = items[to].indexOf(over.id);
      if (newIndex >= 0 && oldIndex !== newIndex) setItems((prev) => ({ ...prev, [to]: arrayMove(prev[to], oldIndex, newIndex) }));
    }
  };

  const rename = (k, name) => setRoutes((r) => r.map((x) => (x.key === k ? { ...x, name } : x)));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={({ active }) => setActiveId(active.id)}
      onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="plan-board">
        <Column id={POOL} className="pool-column">
          <div className="column-head">
            <strong>{t('plan.notPlanned')} <span className="muted">({items[POOL].length})</span></strong>
          </div>
          <input type="search" className="small-input" placeholder={t('plan.searchCustomer')} aria-label={t('plan.searchCustomer')}
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <SortableContext items={poolShown} strategy={verticalListSortingStrategy}>
            <ul className="stop-cards">
              {poolShown.map((id) => (
                <StopCard key={id} id={id} branch={branchOf(id)} routes={routes} onMoveTo={onMoveTo} />
              ))}
            </ul>
          </SortableContext>
          {branches.size === 0 && <p className="muted small">{t('plan.noCustomers')}</p>}
        </Column>

        <div className="route-columns">
          {routes.map((r) => (
            <Column key={r.key} id={r.key} className="route-column">
              <div className="column-head">
                <input className="route-name" value={r.name} maxLength={60} aria-label={t('plan.routeName')}
                  onChange={(e) => rename(r.key, e.target.value)} />
                <button className="icon-btn danger" onClick={() => onRemoveRoute(r.key)} aria-label={t('plan.removeRoute')}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
              <SortableContext items={items[r.key]} strategy={verticalListSortingStrategy}>
                <ol className="stop-cards">
                  {items[r.key].map((id, i) => (
                    <StopCard key={id} id={id} index={i + 1} branch={branchOf(id)} onRemove={() => onMoveTo(id, POOL)} />
                  ))}
                </ol>
              </SortableContext>
              {items[r.key].length === 0 && <p className="drop-hint">{t('plan.dropHere')}</p>}
            </Column>
          ))}
          <button className="add-route" onClick={onAddRoute}>
            <Icon name="plus" /> {t('plan.addRoute')}
          </button>
        </div>
      </div>

      <DragOverlay>
        {activeId ? <div className="stop-card dragging"><BranchLabel branch={branchOf(activeId)} /></div> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ id, className, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`plan-column ${className} ${isOver ? 'over' : ''}`}>
      {children}
    </div>
  );
}

function BranchLabel({ branch }) {
  return (
    <span className="branch-label">
      <strong>{branch.customerName}</strong>
      {branch.branchName !== branch.customerName && <span> · {branch.branchName}</span>}
      {branch.city && <span className="muted small block">{branch.city}</span>}
    </span>
  );
}

// One restaurant. Drag it, or (handy on phones) use the buttons to move it.
function StopCard({ id, index, branch, routes, onMoveTo, onRemove }) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };
  const stop = (e) => e.stopPropagation();
  // Keeps clicks and key presses on the small buttons from starting a drag.
  const guard = { onPointerDown: stop, onMouseDown: stop, onTouchStart: stop, onKeyDown: stop };

  return (
    <li ref={setNodeRef} style={style} className="stop-card" {...attributes} {...listeners}>
      <div className="stop-card-main">
        {index && <span className="stop-number">{index}</span>}
        <BranchLabel branch={branch} />
        {onRemove && (
          <button className="icon-btn small" {...guard} onClick={onRemove}
            aria-label={t('plan.removeStop')}>
            <Icon name="close" size={16} />
          </button>
        )}
        {routes && routes.length > 0 && (
          <button className="icon-btn small add" {...guard}
            onClick={() => setPicking(!picking)} aria-label={t('plan.addToRoute')} aria-expanded={picking}>
            <Icon name="plus" size={16} />
          </button>
        )}
      </div>
      {picking && (
        <div className="route-picker" {...guard}>
          {routes.map((r) => (
            <button key={r.key} className="chip" onClick={() => onMoveTo(id, r.key)}>{r.name}</button>
          ))}
        </div>
      )}
    </li>
  );
}
