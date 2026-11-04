import { Router } from 'express';
import { db, transaction } from '../db.js';
import { hashPin, endAllSessions } from '../auth.js';
import {
  HttpError, cleanStr, normalizePhone, generatePin, ROLES, TEAM_ROLES, CUSTOMER_ROLES, LANGUAGES,
} from '../util.js';

// Every route here is mounted behind requireRole('admin') in index.js.
const router = Router();

const BRANCH_COLS = 'id, customer_id AS customerId, name, street, postal_code AS postalCode, city, phone';
const USER_COLS = `id, name, phone, role, customer_id AS customerId, branch_id AS branchId, language, active,
  last_login_at AS lastLoginAt, created_at AS createdAt`;

const toUser = (row) => row && { ...row, active: Boolean(row.active) };
const getUser = (id) => toUser(db.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).get(id));
const count = (sql, ...params) => db.prepare(sql).get(...params).n;

function findOr404(sql, id) {
  const row = db.prepare(sql).get(Number(id));
  if (!row) throw new HttpError(404, 'not_found');
  return row;
}

// ---------- Dashboard ----------

router.get('/stats', (req, res) => {
  res.json({
    customers: count('SELECT COUNT(*) AS n FROM customers'),
    branches: count('SELECT COUNT(*) AS n FROM branches'),
    customerUsers: count(`SELECT COUNT(*) AS n FROM users WHERE role IN ('owner', 'staff')`),
    team: count(`SELECT COUNT(*) AS n FROM users WHERE role IN ('admin', 'warehouse')`),
    neverLoggedIn: count(`SELECT COUNT(*) AS n FROM users WHERE role IN ('owner', 'staff') AND last_login_at IS NULL`),
  });
});

// ---------- Customers ----------

function readBranch(body) {
  const branch = {
    name: cleanStr(body.name, 100),
    street: cleanStr(body.street, 150),
    postalCode: cleanStr(body.postalCode, 10),
    city: cleanStr(body.city, 80),
    phone: '',
  };
  if (!branch.name) throw new HttpError(400, 'name_required');
  if (cleanStr(body.phone)) {
    branch.phone = normalizePhone(body.phone);
    if (!branch.phone) throw new HttpError(400, 'invalid_phone');
  }
  return branch;
}

const insertBranch = (customerId, b) =>
  Number(
    db.prepare('INSERT INTO branches (customer_id, name, street, postal_code, city, phone) VALUES (?, ?, ?, ?, ?, ?)')
      .run(customerId, b.name, b.street, b.postalCode, b.city, b.phone).lastInsertRowid
  );

router.get('/customers', (req, res) => {
  const q = `%${cleanStr(req.query.q, 100)}%`;
  const customers = db
    .prepare(
      `SELECT c.id, c.name, c.notes, c.created_at AS createdAt,
         (SELECT COUNT(*) FROM branches b WHERE b.customer_id = c.id) AS branchCount,
         (SELECT COUNT(*) FROM users u WHERE u.customer_id = c.id) AS userCount,
         (SELECT GROUP_CONCAT(DISTINCT b.city) FROM branches b WHERE b.customer_id = c.id AND b.city <> '') AS cities
       FROM customers c
       WHERE c.name LIKE ?
          OR EXISTS (SELECT 1 FROM branches b WHERE b.customer_id = c.id AND (b.name LIKE ? OR b.city LIKE ?))
       ORDER BY c.name COLLATE NOCASE`
    )
    .all(q, q, q)
    .map((c) => ({ ...c, cities: c.cities ? c.cities.split(',') : [] }));
  res.json({ customers });
});

router.post('/customers', (req, res) => {
  const name = cleanStr(req.body.name, 100);
  if (!name) throw new HttpError(400, 'name_required');
  const notes = cleanStr(req.body.notes, 1000);
  const branch = readBranch({ ...req.body.branch, name: cleanStr(req.body.branch?.name) || name });

  const id = transaction(() => {
    const customerId = Number(db.prepare('INSERT INTO customers (name, notes) VALUES (?, ?)').run(name, notes).lastInsertRowid);
    insertBranch(customerId, branch);
    return customerId;
  });
  res.status(201).json({ id });
});

router.get('/customers/:id', (req, res) => {
  const customer = findOr404('SELECT id, name, notes, created_at AS createdAt FROM customers WHERE id = ?', req.params.id);
  res.json({
    customer,
    branches: db.prepare(`SELECT ${BRANCH_COLS} FROM branches WHERE customer_id = ? ORDER BY name COLLATE NOCASE`).all(customer.id),
    users: db
      .prepare(`SELECT ${USER_COLS} FROM users WHERE customer_id = ? ORDER BY role, name COLLATE NOCASE`)
      .all(customer.id)
      .map(toUser),
  });
});

router.patch('/customers/:id', (req, res) => {
  const customer = findOr404('SELECT id, name, notes FROM customers WHERE id = ?', req.params.id);
  const name = req.body.name !== undefined ? cleanStr(req.body.name, 100) : customer.name;
  const notes = req.body.notes !== undefined ? cleanStr(req.body.notes, 1000) : customer.notes;
  if (!name) throw new HttpError(400, 'name_required');
  db.prepare('UPDATE customers SET name = ?, notes = ? WHERE id = ?').run(name, notes, customer.id);
  res.status(204).end();
});

router.delete('/customers/:id', (req, res) => {
  const customer = findOr404('SELECT id FROM customers WHERE id = ?', req.params.id);
  transaction(() => {
    // Users first: staff reference branches, which have no cascade.
    db.prepare('DELETE FROM users WHERE customer_id = ?').run(customer.id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(customer.id);
  });
  res.status(204).end();
});

// ---------- Branches ----------

router.post('/customers/:id/branches', (req, res) => {
  const customer = findOr404('SELECT id FROM customers WHERE id = ?', req.params.id);
  const id = insertBranch(customer.id, readBranch(req.body));
  res.status(201).json({ id });
});

router.patch('/branches/:id', (req, res) => {
  const branch = findOr404('SELECT id FROM branches WHERE id = ?', req.params.id);
  const b = readBranch(req.body);
  db.prepare('UPDATE branches SET name = ?, street = ?, postal_code = ?, city = ?, phone = ? WHERE id = ?')
    .run(b.name, b.street, b.postalCode, b.city, b.phone, branch.id);
  res.status(204).end();
});

router.delete('/branches/:id', (req, res) => {
  const branch = findOr404('SELECT id, customer_id FROM branches WHERE id = ?', req.params.id);
  if (count('SELECT COUNT(*) AS n FROM branches WHERE customer_id = ?', branch.customer_id) <= 1)
    throw new HttpError(409, 'last_branch');
  if (count('SELECT COUNT(*) AS n FROM users WHERE branch_id = ?', branch.id) > 0)
    throw new HttpError(409, 'branch_has_staff');
  db.prepare('DELETE FROM branches WHERE id = ?').run(branch.id);
  res.status(204).end();
});

// ---------- Users (customer users and team) ----------

router.get('/team', (req, res) => {
  const users = db
    .prepare(`SELECT ${USER_COLS} FROM users WHERE role IN ('admin', 'warehouse') ORDER BY role, name COLLATE NOCASE`)
    .all()
    .map(toUser);
  res.json({ users });
});

function readUser(body, existing) {
  const name = cleanStr(body.name ?? existing?.name, 80);
  if (!name) throw new HttpError(400, 'name_required');
  const phone = normalizePhone(body.phone ?? existing?.phone);
  if (!phone) throw new HttpError(400, 'invalid_phone');
  const role = body.role ?? existing?.role;
  if (!ROLES.includes(role)) throw new HttpError(400, 'invalid_role');
  // A team member can't become a customer user or the other way round.
  if (existing && TEAM_ROLES.includes(existing.role) !== TEAM_ROLES.includes(role)) throw new HttpError(400, 'invalid_role');
  const language = LANGUAGES.includes(body.language) ? body.language : existing?.language ?? 'de';

  let customerId = null;
  let branchId = null;
  if (CUSTOMER_ROLES.includes(role)) {
    customerId = Number(body.customerId ?? existing?.customerId);
    if (!customerId || !db.prepare('SELECT 1 FROM customers WHERE id = ?').get(customerId))
      throw new HttpError(400, 'customer_required');
    if (role === 'staff') {
      // Owners see every branch; staff belong to exactly one.
      branchId = Number(body.branchId ?? existing?.branchId);
      const branch = branchId && db.prepare('SELECT customer_id FROM branches WHERE id = ?').get(branchId);
      if (!branch || branch.customer_id !== customerId) throw new HttpError(400, 'branch_required');
    }
  }

  if (db.prepare('SELECT 1 FROM users WHERE phone = ? AND id <> ?').get(phone, existing?.id ?? 0))
    throw new HttpError(409, 'phone_taken');

  return { name, phone, role, language, customerId, branchId };
}

function assertAnotherAdmin(userId) {
  if (count(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id <> ?`, userId) === 0)
    throw new HttpError(409, 'last_admin');
}

router.post('/users', (req, res) => {
  const u = readUser(req.body);
  const pin = generatePin();
  const id = Number(
    db.prepare(
      `INSERT INTO users (name, phone, pin_hash, role, customer_id, branch_id, language) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(u.name, u.phone, hashPin(pin), u.role, u.customerId, u.branchId, u.language).lastInsertRowid
  );
  // The PIN is only ever returned here and on reset; it is stored hashed.
  res.status(201).json({ user: getUser(id), pin });
});

router.patch('/users/:id', (req, res) => {
  const existing = getUser(Number(req.params.id));
  if (!existing) throw new HttpError(404, 'not_found');
  const u = readUser(req.body, existing);
  const active = req.body.active !== undefined ? Boolean(req.body.active) : existing.active;

  const losesAdmin = existing.role === 'admin' && existing.active && (u.role !== 'admin' || !active);
  if (existing.id === req.user.id && (u.role !== existing.role || !active)) throw new HttpError(409, 'cannot_change_self');
  if (losesAdmin) assertAnotherAdmin(existing.id);

  db.prepare(
    'UPDATE users SET name = ?, phone = ?, role = ?, customer_id = ?, branch_id = ?, language = ?, active = ? WHERE id = ?'
  ).run(u.name, u.phone, u.role, u.customerId, u.branchId, u.language, active ? 1 : 0, existing.id);
  if (!active) endAllSessions(existing.id);
  res.json({ user: getUser(existing.id) });
});

router.post('/users/:id/reset-pin', (req, res) => {
  const user = getUser(Number(req.params.id));
  if (!user) throw new HttpError(404, 'not_found');
  if (user.id === req.user.id) throw new HttpError(409, 'cannot_change_self');
  const pin = generatePin();
  db.prepare('UPDATE users SET pin_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?').run(hashPin(pin), user.id);
  endAllSessions(user.id);
  res.json({ user, pin });
});

router.delete('/users/:id', (req, res) => {
  const user = getUser(Number(req.params.id));
  if (!user) throw new HttpError(404, 'not_found');
  if (user.id === req.user.id) throw new HttpError(409, 'cannot_change_self');
  if (user.role === 'admin' && user.active) assertAnotherAdmin(user.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  res.status(204).end();
});

export default router;
