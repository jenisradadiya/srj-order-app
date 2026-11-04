import { Router } from 'express';
import { db } from '../db.js';
import { HttpError, cleanStr } from '../util.js';
import { getMissing, getOrderDetail, listOrders } from '../orders.js';
import { effectivePlan, isDate } from '../plans.js';

// For SRJ's own people (admin and warehouse). Mounted behind requireRole('admin', 'warehouse').
// The warehouse can read orders and write notes, but never change an order.
const router = Router();

const OPEN = `o.status IN ('sent', 'accepted')`;

router.get('/orders', (req, res) => {
  const where = [];
  const params = [];
  const status = req.query.status || 'open';
  if (status === 'open') where.push(OPEN);
  else if (['sent', 'accepted', 'delivered'].includes(status)) {
    where.push('o.status = ?');
    params.push(status);
  }
  const q = cleanStr(req.query.q, 100);
  if (q) {
    if (/^#?\d+$/.test(q)) {
      where.push('o.id = ?');
      params.push(Number(q.replace('#', '')));
    } else {
      where.push('(c.name LIKE ? OR b.name LIKE ? OR b.city LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
  }
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.json(listOrders({ where, params, limit, offset }));
});

router.get('/orders/:id', (req, res) => {
  const order = getOrderDetail(req.params.id);
  if (!order) throw new HttpError(404, 'not_found');
  res.json({ order: { ...order, missing: getMissing(order.id) } });
});

// ---------- Missing items (for one order) ----------

router.post('/orders/:id/missing', (req, res) => {
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) throw new HttpError(404, 'not_found');
  const text = cleanStr(req.body.text, 300);
  if (!text) throw new HttpError(400, 'text_required');
  db.prepare('INSERT INTO missing_items (order_id, text, user_id, user_name) VALUES (?, ?, ?, ?)')
    .run(order.id, text, req.user.id, req.user.name);
  res.status(201).json({ missing: getMissing(order.id) });
});

// Writers can remove their own notes; admins can remove any.
function assertCanRemove(row, user) {
  if (!row) throw new HttpError(404, 'not_found');
  if (user.role !== 'admin' && row.user_id !== user.id) throw new HttpError(403, 'forbidden');
}

router.delete('/missing/:id', (req, res) => {
  const row = db.prepare('SELECT id, order_id, user_id FROM missing_items WHERE id = ?').get(Number(req.params.id));
  assertCanRemove(row, req.user);
  db.prepare('DELETE FROM missing_items WHERE id = ?').run(row.id);
  res.json({ missing: getMissing(row.order_id) });
});

// Latest notes across all orders (admin dashboard and stock page).
router.get('/missing', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const notes = db
    .prepare(
      `SELECT m.id, m.text, m.user_name AS userName, m.created_at AS createdAt, m.order_id AS orderId,
              c.name AS customerName, b.name AS branchName
       FROM missing_items m
       JOIN orders o ON o.id = m.order_id
       JOIN customers c ON c.id = o.customer_id
       JOIN branches b ON b.id = o.branch_id
       ORDER BY m.id DESC LIMIT ?`
    )
    .all(limit);
  res.json({ notes });
});

// ---------- Finished items (whole warehouse out of stock) ----------

const FINISHED_COLS = `id, text, user_id AS userId, user_name AS userName, created_at AS createdAt,
  resolved_at AS resolvedAt, resolved_by AS resolvedBy`;

router.get('/finished', (req, res) => {
  const open = db.prepare(`SELECT ${FINISHED_COLS} FROM finished_items WHERE resolved_at IS NULL ORDER BY id DESC`).all();
  const resolved = db
    .prepare(`SELECT ${FINISHED_COLS} FROM finished_items WHERE resolved_at IS NOT NULL ORDER BY resolved_at DESC LIMIT 30`)
    .all();
  res.json({ open, resolved });
});

router.post('/finished', (req, res) => {
  const text = cleanStr(req.body.text, 200);
  if (!text) throw new HttpError(400, 'text_required');
  db.prepare('INSERT INTO finished_items (text, user_id, user_name) VALUES (?, ?, ?)').run(text, req.user.id, req.user.name);
  res.status(201).end();
});

// Back in stock (e.g. the shipment arrived). Kept in history.
router.post('/finished/:id/resolve', (req, res) => {
  const { changes } = db
    .prepare('UPDATE finished_items SET resolved_at = ?, resolved_by = ? WHERE id = ? AND resolved_at IS NULL')
    .run(new Date().toISOString(), req.user.name, Number(req.params.id));
  if (!changes) throw new HttpError(404, 'not_found');
  res.status(204).end();
});

router.delete('/finished/:id', (req, res) => {
  const row = db.prepare('SELECT id, user_id FROM finished_items WHERE id = ?').get(Number(req.params.id));
  assertCanRemove(row, req.user);
  db.prepare('DELETE FROM finished_items WHERE id = ?').run(row.id);
  res.status(204).end();
});

// ---------- Day view: routes of a date with each stop's open orders ----------

router.get('/day', (req, res) => {
  const date = String(req.query.date || '');
  if (!isDate(date)) throw new HttpError(400, 'bad_request');
  const plan = effectivePlan(date);

  const { orders: open } = listOrders({ where: [OPEN], params: [], limit: 1000 });
  const byBranch = new Map();
  for (const o of open) {
    if (!byBranch.has(o.branchId)) byBranch.set(o.branchId, []);
    byBranch.get(o.branchId).push(o);
  }
  const onRoute = new Set();
  const routes = plan.routes.map((r) => ({
    ...r,
    stops: r.stops.map((s) => {
      onRoute.add(s.branchId);
      return { ...s, orders: (byBranch.get(s.branchId) || []).reverse() };
    }),
  }));
  const otherOrders = open.filter((o) => !onRoute.has(o.branchId)).reverse();

  res.json({ ...plan, routes, otherOrders });
});

export default router;
