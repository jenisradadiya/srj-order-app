import { Router } from 'express';
import { db } from '../db.js';
import { HttpError } from '../util.js';
import { addDays, getPlan, isDate, resetDay, savePlan, weekdayOf } from '../plans.js';

// Route planning. Mounted behind requireRole('admin').
const router = Router();

// Every branch, for the "not on a route" list in the planner.
router.get('/routes/branches', (req, res) => {
  const branches = db
    .prepare(
      `SELECT b.id, b.name AS branchName, b.city, c.id AS customerId, c.name AS customerName
       FROM branches b JOIN customers c ON c.id = b.customer_id
       ORDER BY c.name COLLATE NOCASE, b.name COLLATE NOCASE`
    )
    .all();
  res.json({ branches });
});

// Seven days starting at `start` (should be a Monday), with their routes.
router.get('/routes/week', (req, res) => {
  const start = String(req.query.start || '');
  if (!isDate(start)) throw new HttpError(400, 'bad_request');
  const days = [];
  for (let i = 0; i < 7; i++) {
    const plan = getPlan(`d${addDays(start, i)}`);
    days.push({
      date: plan.date,
      weekday: weekdayOf(plan.date),
      custom: plan.custom,
      routes: plan.routes.map((r) => ({ name: r.name, stops: r.stops.map((s) => s.customerName) })),
    });
  }
  res.json({ days });
});

router.get('/routes/plan/:key', (req, res) => {
  res.json({ plan: getPlan(req.params.key) });
});

router.put('/routes/plan/:key', (req, res) => {
  res.json({ plan: savePlan(req.params.key, req.body.routes) });
});

// Day goes back to the weekly template.
router.delete('/routes/plan/:key', (req, res) => {
  const date = req.params.key.slice(1);
  if (!req.params.key.startsWith('d') || !isDate(date)) throw new HttpError(400, 'bad_request');
  resetDay(date);
  res.json({ plan: getPlan(req.params.key) });
});

export default router;
