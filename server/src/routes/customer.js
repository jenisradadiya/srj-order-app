import { Router } from 'express';
import { db, transaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { HttpError, cleanStr } from '../util.js';
import { getOrderDetail, listOrders } from '../orders.js';
import { adminIds, notifyUsers } from '../notify.js';

// Catalog and orders for restaurant owners and staff.
const router = Router();

const MAX_ITEMS = 300;
const MAX_QUANTITY = 10000;

// Owners see every order of their company; staff see the orders of their branch.
function orderScope(user) {
  return user.role === 'owner'
    ? { where: ['o.customer_id = ?'], params: [user.customerId] }
    : { where: ['o.branch_id = ?'], params: [user.branchId] };
}

// The whole active catalog in one compact response (a few hundred KB for 3,500 articles),
// so the app can search instantly on the phone.
router.get('/catalog', requireAuth, (req, res) => {
  const categories = db.prepare('SELECT id, name FROM categories ORDER BY sort, name COLLATE NOCASE').all();
  const products = db
    .prepare('SELECT id, name, category_id AS categoryId, unit, sizes FROM products WHERE active = 1 ORDER BY name COLLATE NOCASE')
    .all();

  let frequent = [];
  if (req.user.role === 'owner' || req.user.role === 'staff') {
    const scope = orderScope(req.user);
    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    frequent = db
      .prepare(
        `SELECT i.product_id AS id FROM order_items i JOIN orders o ON o.id = i.order_id JOIN products p ON p.id = i.product_id
         WHERE ${scope.where[0]} AND o.created_at >= ? AND p.active = 1
         GROUP BY i.product_id ORDER BY COUNT(*) DESC, MAX(o.created_at) DESC LIMIT 80`
      )
      .all(...scope.params, since)
      .map((r) => r.id);
  }
  res.json({ categories, products, frequent });
});

router.get('/orders', requireRole('owner', 'staff'), (req, res) => {
  const scope = orderScope(req.user);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.json(listOrders({ ...scope, limit, offset }));
});

router.get('/orders/:id', requireRole('owner', 'staff'), (req, res) => {
  const order = getOrderDetail(req.params.id);
  const allowed =
    order && (req.user.role === 'owner' ? order.customer.id === req.user.customerId : order.branch.id === req.user.branchId);
  if (!allowed) throw new HttpError(404, 'not_found');
  res.json({ order });
});

function readQuantity(value) {
  const q = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(q) || q <= 0 || q > MAX_QUANTITY) throw new HttpError(400, 'invalid_quantity');
  return q;
}

router.post('/orders', requireRole('owner', 'staff'), (req, res) => {
  const user = req.user;
  const body = req.body;
  const clientRef = cleanStr(body.clientRef, 64) || null;

  // Sent twice (e.g. bad mobile connection)? Return the order that already exists.
  if (clientRef) {
    const existing = db.prepare('SELECT id FROM orders WHERE client_ref = ? AND customer_id = ?').get(clientRef, user.customerId);
    if (existing) return res.json({ order: getOrderDetail(existing.id) });
  }

  // Branch: staff always order for their own branch; owners choose one of theirs.
  const branchId = user.role === 'staff' ? user.branchId : Number(body.branchId);
  const branch = db.prepare('SELECT id FROM branches WHERE id = ? AND customer_id = ?').get(branchId, user.customerId);
  if (!branch) throw new HttpError(400, 'branch_required');

  const usedVoices = new Set();
  const checkVoice = (id) => {
    if (!id) return null;
    const voice = db.prepare('SELECT id, customer_id, order_id FROM voice_messages WHERE id = ?').get(String(id));
    if (!voice || voice.customer_id !== user.customerId || voice.order_id || usedVoices.has(voice.id))
      throw new HttpError(400, 'voice_invalid');
    usedVoices.add(voice.id);
    return voice.id;
  };

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length > MAX_ITEMS) throw new HttpError(400, 'too_many_items');
  const items = rawItems.map((it) => {
    const quantity = readQuantity(it.quantity);
    const note = cleanStr(it.note, 300);
    const voiceId = checkVoice(it.voiceId);
    const product = it.productId ? db.prepare('SELECT id, name, unit FROM products WHERE id = ?').get(Number(it.productId)) : null;
    if (product) return { productId: product.id, name: product.name, unit: product.unit, quantity, note, voiceId, isCustom: 0 };
    // Free item ("other item"), or a product that was removed meanwhile: keep the name the customer saw.
    const name = cleanStr(it.name, 120);
    if (!name) throw new HttpError(400, 'item_name_required');
    return { productId: null, name, unit: cleanStr(it.unit, 30), quantity, note, voiceId, isCustom: it.productId ? 0 : 1 };
  });

  const note = cleanStr(body.note, 1000);
  const voiceId = checkVoice(body.voiceId);
  if (items.length === 0 && !note && !voiceId) throw new HttpError(400, 'empty_order');

  const userRow = db.prepare('SELECT name FROM users WHERE id = ?').get(user.id);
  const orderId = transaction(() => {
    const id = Number(
      db.prepare(
        `INSERT INTO orders (client_ref, customer_id, branch_id, user_id, user_name, user_role, note, voice_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(clientRef, user.customerId, branch.id, user.id, userRow.name, user.role, note, voiceId).lastInsertRowid
    );
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, position, product_id, product_name, unit, quantity, note, voice_id, is_custom)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    items.forEach((it, index) =>
      insertItem.run(id, index + 1, it.productId, it.name, it.unit, it.quantity, it.note, it.voiceId, it.isCustom)
    );
    const linkVoice = db.prepare('UPDATE voice_messages SET order_id = ? WHERE id = ?');
    for (const v of usedVoices) linkVoice.run(id, v);
    return id;
  });

  const order = getOrderDetail(orderId);
  notifyUsers(adminIds(), 'newOrder', {
    id: order.id, customer: order.customer.name, branch: order.branch.name, items: order.items.length,
  }, `/admin/orders/${order.id}`);
  res.status(201).json({ order });
});

export default router;
