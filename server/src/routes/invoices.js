import { Router, raw } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, dataDir, transaction } from '../db.js';
import { requireRole } from '../auth.js';
import { HttpError, cleanStr } from '../util.js';
import { isDate } from '../plans.js';
import { notifyUsers, ownerIds } from '../notify.js';

// Bills (Rechnungen) and payments.
//  - adminInvoices: everything, mounted behind requireRole('admin')
//  - customerInvoices: an owner's own bills (staff never see bills)

export const invoiceDir = path.join(dataDir, 'invoices');
fs.mkdirSync(invoiceDir, { recursive: true });

const FILE_ID = /^[0-9a-f-]{36}$/;
const MAX_PDF = 15 * 1024 * 1024;
const MAX_CENTS = 100_000_000; // 1,000,000 €
const METHODS = ['bank', 'cash', 'other'];

const filePath = (fileId) => path.join(invoiceDir, `${fileId}.pdf`);
const removeFile = (fileId) => fileId && fs.rmSync(filePath(fileId), { force: true });

const SELECT = `
  SELECT i.id, i.number, i.invoice_date AS date, i.amount_cents AS amount, i.note,
         i.customer_id AS customerId, c.name AS customerName,
         i.branch_id AS branchId, b.name AS branchName, i.order_id AS orderId,
         i.file_name AS fileName, (i.file_id IS NOT NULL) AS hasFile,
         i.created_by AS createdBy, i.created_at AS createdAt,
         COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid,
         (SELECT MAX(p.paid_on) FROM payments p WHERE p.invoice_id = i.id) AS lastPaidOn
  FROM invoices i
  JOIN customers c ON c.id = i.customer_id
  LEFT JOIN branches b ON b.id = i.branch_id`;

function toInvoice(row) {
  if (!row) return null;
  const open = Math.max(0, row.amount - row.paid);
  return {
    ...row,
    hasFile: Boolean(row.hasFile),
    open,
    status: open === 0 ? 'paid' : row.paid > 0 ? 'partial' : 'open',
  };
}

// Filtered list plus totals over the whole filter (not just the current page).
function listInvoices({ where = [], params = [], status, limit = 100, offset = 0 }) {
  const inner = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
  const statusClause = status === 'open' ? 'WHERE x.paid < x.amount' : status === 'paid' ? 'WHERE x.paid >= x.amount' : '';
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(x.amount), 0) AS amount, COALESCE(SUM(x.paid), 0) AS paid,
              COALESCE(SUM(CASE WHEN x.paid < x.amount THEN 1 ELSE 0 END), 0) AS openCount
       FROM (${inner}) x ${statusClause}`
    )
    .get(...params);
  const invoices = db
    .prepare(`SELECT * FROM (${inner}) x ${statusClause} ORDER BY x.date DESC, x.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset)
    .map(toInvoice);
  return { invoices, totals: { ...totals, open: totals.amount - totals.paid } };
}

const getInvoice = (id) => toInvoice(db.prepare(`${SELECT} WHERE i.id = ?`).get(Number(id)));

const getPayments = (invoiceId) =>
  db.prepare(
    `SELECT id, amount_cents AS amount, paid_on AS date, method, note, created_by AS createdBy, created_at AS createdAt
     FROM payments WHERE invoice_id = ? ORDER BY paid_on, id`
  ).all(invoiceId);

const withPayments = (invoice) => ({ ...invoice, payments: getPayments(invoice.id) });

function readCents(value) {
  const cents = Number(value);
  if (!Number.isInteger(cents) || cents <= 0 || cents > MAX_CENTS) throw new HttpError(400, 'invalid_amount');
  return cents;
}

function readDate(value) {
  const date = String(value ?? '');
  if (!isDate(date)) throw new HttpError(400, 'invalid_date');
  return date;
}

function sendPdf(res, fileId, name) {
  if (!fileId || !fs.existsSync(filePath(fileId))) throw new HttpError(404, 'not_found');
  const safeName = (name || 'Rechnung.pdf').replace(/[^\w.\- ]+/g, '_');
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${safeName}"`);
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(filePath(fileId));
}

// ================= Admin =================

export const adminInvoices = Router();

// Step 1 of adding a bill: upload the PDF, get a file id back.
adminInvoices.post('/invoice-files', raw({ type: () => true, limit: MAX_PDF }), (req, res) => {
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length < 100 || body.subarray(0, 5).toString('latin1') !== '%PDF-')
    throw new HttpError(400, 'pdf_invalid');
  const fileId = crypto.randomUUID();
  fs.writeFileSync(filePath(fileId), body);
  res.status(201).json({ fileId });
});

adminInvoices.get('/invoices', (req, res) => {
  const where = [];
  const params = [];
  if (req.query.customerId) {
    where.push('i.customer_id = ?');
    params.push(Number(req.query.customerId));
  }
  if (req.query.orderId) {
    where.push('i.order_id = ?');
    params.push(Number(req.query.orderId));
  }
  const q = cleanStr(req.query.q, 100);
  if (q) {
    where.push('(i.number LIKE ? OR c.name LIKE ? OR b.name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.json(listInvoices({ where, params, status: req.query.status, limit, offset }));
});

adminInvoices.get('/invoices/:id', (req, res) => {
  const invoice = getInvoice(req.params.id);
  if (!invoice) throw new HttpError(404, 'not_found');
  res.json({ invoice: withPayments(invoice) });
});

adminInvoices.get('/invoices/:id/pdf', (req, res) => {
  const row = db.prepare('SELECT file_id, file_name FROM invoices WHERE id = ?').get(Number(req.params.id));
  if (!row) throw new HttpError(404, 'not_found');
  sendPdf(res, row.file_id, row.file_name);
});

// Validates customer / branch / order belong together, and the rest of the fields.
function readInvoice(body, existing) {
  const customerId = Number(body.customerId ?? existing?.customerId);
  if (!customerId || !db.prepare('SELECT 1 FROM customers WHERE id = ?').get(customerId)) throw new HttpError(400, 'customer_required');

  const branchRaw = body.branchId !== undefined ? body.branchId : existing?.branchId;
  const branchId = branchRaw ? Number(branchRaw) : null;
  if (branchId && !db.prepare('SELECT 1 FROM branches WHERE id = ? AND customer_id = ?').get(branchId, customerId))
    throw new HttpError(400, 'bad_request');

  const orderRaw = body.orderId !== undefined ? body.orderId : existing?.orderId;
  const orderId = orderRaw ? Number(orderRaw) : null;
  if (orderId && !db.prepare('SELECT 1 FROM orders WHERE id = ? AND customer_id = ?').get(orderId, customerId))
    throw new HttpError(400, 'order_not_found');

  const number = cleanStr(body.number ?? existing?.number, 50);
  if (!number) throw new HttpError(400, 'number_required');
  if (db.prepare('SELECT 1 FROM invoices WHERE number = ? COLLATE NOCASE AND id <> ?').get(number, existing?.id ?? 0))
    throw new HttpError(409, 'invoice_number_taken');

  return {
    customerId,
    branchId,
    orderId,
    number,
    date: readDate(body.date ?? existing?.date),
    amount: readCents(body.amount ?? existing?.amount),
    note: cleanStr(body.note ?? existing?.note ?? '', 500),
  };
}

function readFileId(value) {
  if (!value) return null;
  const fileId = String(value);
  if (!FILE_ID.test(fileId) || !fs.existsSync(filePath(fileId))) throw new HttpError(400, 'pdf_invalid');
  return fileId;
}

adminInvoices.post('/invoices', (req, res) => {
  const inv = readInvoice(req.body);
  const fileId = readFileId(req.body.fileId);
  const id = Number(
    db.prepare(
      `INSERT INTO invoices (customer_id, branch_id, order_id, number, invoice_date, amount_cents, note, file_id, file_name, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(inv.customerId, inv.branchId, inv.orderId, inv.number, inv.date, inv.amount, inv.note,
      fileId, fileId ? cleanStr(req.body.fileName, 120) || `${inv.number}.pdf` : null, req.user.name).lastInsertRowid
  );
  const invoice = getInvoice(id);
  const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(invoice.amount / 100);
  notifyUsers(ownerIds(invoice.customerId), 'newBill', { number: invoice.number, amount: euro, customer: invoice.customerName }, `/bills/${id}`);
  res.status(201).json({ invoice: withPayments(invoice) });
});

adminInvoices.patch('/invoices/:id', (req, res) => {
  const existing = getInvoice(req.params.id);
  if (!existing) throw new HttpError(404, 'not_found');
  const inv = readInvoice(req.body, existing);
  if (inv.amount < existing.paid) throw new HttpError(409, 'amount_below_paid');

  const old = db.prepare('SELECT file_id, file_name FROM invoices WHERE id = ?').get(existing.id);
  let fileId = old.file_id;
  let fileName = old.file_name;
  if (req.body.fileId !== undefined) {
    fileId = readFileId(req.body.fileId);
    fileName = fileId ? cleanStr(req.body.fileName, 120) || `${inv.number}.pdf` : null;
  }
  db.prepare(
    `UPDATE invoices SET customer_id = ?, branch_id = ?, order_id = ?, number = ?, invoice_date = ?, amount_cents = ?,
       note = ?, file_id = ?, file_name = ? WHERE id = ?`
  ).run(inv.customerId, inv.branchId, inv.orderId, inv.number, inv.date, inv.amount, inv.note, fileId, fileName, existing.id);
  if (old.file_id && old.file_id !== fileId) removeFile(old.file_id);
  res.json({ invoice: withPayments(getInvoice(existing.id)) });
});

adminInvoices.delete('/invoices/:id', (req, res) => {
  const row = db.prepare('SELECT id, file_id FROM invoices WHERE id = ?').get(Number(req.params.id));
  if (!row) throw new HttpError(404, 'not_found');
  db.prepare('DELETE FROM invoices WHERE id = ?').run(row.id); // payments go with it
  removeFile(row.file_id);
  res.status(204).end();
});

adminInvoices.post('/invoices/:id/payments', (req, res) => {
  const invoice = getInvoice(req.params.id);
  if (!invoice) throw new HttpError(404, 'not_found');
  const amount = readCents(req.body.amount);
  if (amount > invoice.open) throw new HttpError(409, 'payment_too_high');
  const method = METHODS.includes(req.body.method) ? req.body.method : 'bank';
  transaction(() => {
    db.prepare('INSERT INTO payments (invoice_id, amount_cents, paid_on, method, note, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run(invoice.id, amount, readDate(req.body.date), method, cleanStr(req.body.note, 300), req.user.name);
  });
  res.status(201).json({ invoice: withPayments(getInvoice(invoice.id)) });
});

adminInvoices.delete('/payments/:id', (req, res) => {
  const payment = db.prepare('SELECT id, invoice_id FROM payments WHERE id = ?').get(Number(req.params.id));
  if (!payment) throw new HttpError(404, 'not_found');
  db.prepare('DELETE FROM payments WHERE id = ?').run(payment.id);
  res.json({ invoice: withPayments(getInvoice(payment.invoice_id)) });
});

// PDFs that were uploaded but never attached to a bill (e.g. the form was closed).
export function cleanupInvoiceFiles() {
  const used = new Set(db.prepare('SELECT file_id FROM invoices WHERE file_id IS NOT NULL').all().map((r) => r.file_id));
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const name of fs.readdirSync(invoiceDir)) {
    const fileId = name.replace(/\.pdf$/, '');
    const full = path.join(invoiceDir, name);
    if (!used.has(fileId) && fs.statSync(full).mtimeMs < dayAgo) fs.rmSync(full, { force: true });
  }
}

// ================= Owner =================

export const customerInvoices = Router();
customerInvoices.use('/invoices', requireRole('owner'));

customerInvoices.get('/invoices', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const all = listInvoices({ where: ['i.customer_id = ?'], params: [req.user.customerId] , limit: 1 });
  const list = listInvoices({ where: ['i.customer_id = ?'], params: [req.user.customerId], status: req.query.status, limit, offset });
  // Totals always over all bills, whatever tab is shown.
  res.json({ invoices: list.invoices, count: list.totals.count, totals: all.totals });
});

function ownInvoice(req) {
  const invoice = getInvoice(req.params.id);
  if (!invoice || invoice.customerId !== req.user.customerId) throw new HttpError(404, 'not_found');
  return invoice;
}

customerInvoices.get('/invoices/:id', (req, res) => {
  const { createdBy, ...invoice } = withPayments(ownInvoice(req));
  res.json({ invoice: { ...invoice, payments: invoice.payments.map(({ createdBy: _, ...p }) => p) } });
});

customerInvoices.get('/invoices/:id/pdf', (req, res) => {
  const invoice = ownInvoice(req);
  const row = db.prepare('SELECT file_id, file_name FROM invoices WHERE id = ?').get(invoice.id);
  sendPdf(res, row.file_id, row.file_name);
});
