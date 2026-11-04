import { db } from './db.js';

// Shared read helpers for orders, used by the customer, admin and (later) warehouse routes.

const LIST_SELECT = `
  SELECT o.id, o.status, o.created_at AS createdAt, o.user_name AS userName, o.user_role AS userRole,
         o.customer_id AS customerId, c.name AS customerName, o.branch_id AS branchId, b.name AS branchName,
         b.city AS branchCity,
         (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS itemCount,
         (o.voice_id IS NOT NULL OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.voice_id IS NOT NULL)) AS hasVoice,
         (o.note <> '') AS hasNote,
         (SELECT COUNT(*) FROM missing_items m WHERE m.order_id = o.id) AS missingCount
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  JOIN branches b ON b.id = o.branch_id`;

export function listOrders({ where = [], params = [], limit = 50, offset = 0 }) {
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM orders o JOIN customers c ON c.id = o.customer_id JOIN branches b ON b.id = o.branch_id ${clause}`)
    .get(...params).n;
  const orders = db
    .prepare(`${LIST_SELECT} ${clause} ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset)
    .map((o) => ({ ...o, hasVoice: Boolean(o.hasVoice), hasNote: Boolean(o.hasNote) }));
  return { total, orders };
}

// Warehouse notes for one order. Only SRJ staff may see these, never the customer.
export const getMissing = (orderId) =>
  db.prepare(
    `SELECT id, text, user_id AS userId, user_name AS userName, created_at AS createdAt
     FROM missing_items WHERE order_id = ? ORDER BY id`
  ).all(Number(orderId));

const voiceInfo = (id) => (id ? db.prepare('SELECT id, duration FROM voice_messages WHERE id = ?').get(id) ?? null : null);

export function getOrderDetail(id) {
  const o = db
    .prepare(
      `SELECT o.*, c.name AS customer_name,
              b.name AS branch_name, b.street, b.postal_code, b.city, b.phone AS branch_phone
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN branches b ON b.id = o.branch_id
       WHERE o.id = ?`
    )
    .get(Number(id));
  if (!o) return null;

  const items = db
    .prepare(
      `SELECT i.id, i.product_id AS productId, i.product_name AS name, i.unit, i.quantity, i.note, i.voice_id AS voiceId,
              i.is_custom AS isCustom, cat.name AS categoryName
       FROM order_items i
       LEFT JOIN products p ON p.id = i.product_id
       LEFT JOIN categories cat ON cat.id = p.category_id
       WHERE i.order_id = ? ORDER BY i.position`
    )
    .all(o.id)
    .map(({ voiceId, isCustom, ...item }) => ({ ...item, isCustom: Boolean(isCustom), voice: voiceInfo(voiceId) }));

  return {
    id: o.id,
    status: o.status,
    createdAt: o.created_at,
    acceptedAt: o.accepted_at,
    acceptedBy: o.accepted_by,
    deliveredAt: o.delivered_at,
    note: o.note,
    voice: voiceInfo(o.voice_id),
    user: { id: o.user_id, name: o.user_name, role: o.user_role },
    customer: { id: o.customer_id, name: o.customer_name },
    branch: {
      id: o.branch_id,
      name: o.branch_name,
      street: o.street,
      postalCode: o.postal_code,
      city: o.city,
      phone: o.branch_phone,
    },
    items,
  };
}
