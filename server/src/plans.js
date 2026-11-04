import { db, transaction } from './db.js';
import { HttpError, cleanStr } from './util.js';

// Route plans. "w1".."w7" is the weekly template (Monday..Sunday);
// "d2026-11-05" is one day that was changed from the template.

export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

// 1 = Monday … 7 = Sunday
export function weekdayOf(date) {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function parseKey(key) {
  if (/^w[1-7]$/.test(key)) return { type: 'week', weekday: Number(key[1]) };
  if (key.startsWith('d') && isDate(key.slice(1))) return { type: 'day', date: key.slice(1) };
  throw new HttpError(400, 'bad_request');
}

const isCustomDay = (date) => Boolean(db.prepare('SELECT 1 FROM custom_days WHERE date = ?').get(date));

function readRoutes(planKey) {
  const routes = db.prepare('SELECT id, name FROM plan_routes WHERE plan_key = ? ORDER BY position').all(planKey);
  const stops = db.prepare(
    `SELECT s.branch_id AS branchId, b.name AS branchName, b.street, b.postal_code AS postalCode, b.city,
            c.id AS customerId, c.name AS customerName
     FROM plan_stops s
     JOIN branches b ON b.id = s.branch_id
     JOIN customers c ON c.id = b.customer_id
     WHERE s.route_id = ? ORDER BY s.position`
  );
  return routes.map((r) => ({ id: r.id, name: r.name, stops: stops.all(r.id) }));
}

// What actually happens on a date: its own plan if it was changed, otherwise the weekly template.
export function effectivePlan(date) {
  const weekday = weekdayOf(date);
  const custom = isCustomDay(date);
  return { date, weekday, custom, routes: readRoutes(custom ? `d${date}` : `w${weekday}`) };
}

export function getPlan(key) {
  const k = parseKey(key);
  if (k.type === 'week') return { key, weekday: k.weekday, custom: false, routes: readRoutes(key) };
  return { key, ...effectivePlan(k.date) };
}

// Replaces a whole plan. routes = [{ name, branchIds: [..] }]
export function savePlan(key, input) {
  const k = parseKey(key);
  if (!Array.isArray(input) || input.length > 20) throw new HttpError(400, 'bad_request');
  const seen = new Set();
  const routes = input.map((r, i) => {
    const branchIds = (Array.isArray(r.branchIds) ? r.branchIds : []).map(Number);
    for (const id of branchIds) {
      if (seen.has(id)) throw new HttpError(400, 'branch_twice');
      if (!db.prepare('SELECT 1 FROM branches WHERE id = ?').get(id)) throw new HttpError(400, 'bad_request');
      seen.add(id);
    }
    return { name: cleanStr(r.name, 60) || `Route ${i + 1}`, branchIds };
  });

  transaction(() => {
    db.prepare('DELETE FROM plan_routes WHERE plan_key = ?').run(key);
    const insertRoute = db.prepare('INSERT INTO plan_routes (plan_key, name, position) VALUES (?, ?, ?)');
    const insertStop = db.prepare('INSERT INTO plan_stops (route_id, branch_id, position) VALUES (?, ?, ?)');
    routes.forEach((r, i) => {
      const routeId = Number(insertRoute.run(key, r.name, i + 1).lastInsertRowid);
      r.branchIds.forEach((branchId, j) => insertStop.run(routeId, branchId, j + 1));
    });
    if (k.type === 'day') db.prepare('INSERT OR IGNORE INTO custom_days (date) VALUES (?)').run(k.date);
  });
  return getPlan(key);
}

// A changed day goes back to following the weekly template.
export function resetDay(date) {
  transaction(() => {
    db.prepare('DELETE FROM plan_routes WHERE plan_key = ?').run(`d${date}`);
    db.prepare('DELETE FROM custom_days WHERE date = ?').run(date);
  });
}
