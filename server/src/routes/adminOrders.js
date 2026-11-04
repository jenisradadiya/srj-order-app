import { Router } from 'express';
import { db } from '../db.js';
import { HttpError, cleanStr } from '../util.js';
import { getOrderDetail, listOrders } from '../orders.js';

// Order inbox for SRJ. Mounted behind requireRole('admin').
const router = Router();

const STATUSES = ['sent', 'accepted', 'delivered'];

router.get('/orders', (req, res) => {
  const where = [];
  const params = [];
  if (STATUSES.includes(req.query.status)) {
    where.push('o.status = ?');
    params.push(req.query.status);
  }
  const q = cleanStr(req.query.q, 100);
  if (q) {
    if (/^#?\d+$/.test(q)) {
      where.push('o.id = ?');
      params.push(Number(q.replace('#', '')));
    } else {
      where.push('(c.name LIKE ? OR b.name LIKE ? OR b.city LIKE ? OR o.user_name LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
  }
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all()) counts[row.status] = row.n;

  res.json({ ...listOrders({ where, params, limit, offset }), counts });
});

router.get('/orders/:id', (req, res) => {
  const order = getOrderDetail(req.params.id);
  if (!order) throw new HttpError(404, 'not_found');
  res.json({ order });
});

// sent -> accepted -> delivered. Going back one step is allowed to fix a mistake.
router.post('/orders/:id/status', (req, res) => {
  const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) throw new HttpError(404, 'not_found');
  const next = req.body.status;
  if (!STATUSES.includes(next)) throw new HttpError(400, 'bad_request');
  if (Math.abs(STATUSES.indexOf(next) - STATUSES.indexOf(order.status)) > 1) throw new HttpError(409, 'invalid_status_change');

  const now = new Date().toISOString();
  if (next === 'sent') {
    db.prepare(`UPDATE orders SET status = 'sent', accepted_at = NULL, accepted_by = NULL WHERE id = ?`).run(order.id);
  } else if (next === 'accepted') {
    // From "sent": record who accepted. From "delivered": just undo the delivery.
    if (order.status === 'sent')
      db.prepare(`UPDATE orders SET status = 'accepted', accepted_at = ?, accepted_by = ? WHERE id = ?`).run(now, req.user.name, order.id);
    else db.prepare(`UPDATE orders SET status = 'accepted', delivered_at = NULL WHERE id = ?`).run(order.id);
  } else {
    db.prepare(`UPDATE orders SET status = 'delivered', delivered_at = ? WHERE id = ?`).run(now, order.id);
  }
  res.json({ order: getOrderDetail(order.id) });
});

export default router;
