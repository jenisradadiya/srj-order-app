import { db, getSetting, setSetting } from './db.js';
import { addDays, effectivePlan } from './plans.js';
import { notifyUsers } from './notify.js';

// Route reminder: the day before a delivery, customers on that day's routes get
// "Tomorrow is your delivery – please send your order".

export const DEFAULT_REMINDER = { enabled: true, time: '14:00' };
export const reminderSettings = () => ({ ...DEFAULT_REMINDER, ...getSetting('reminder', {}) });

// Current date and time in Germany, e.g. { date: '2026-11-04', time: '14:05' }.
export function berlinNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// Sends the reminder for a delivery date. Branches that already have an open order are skipped.
export function sendReminders(date) {
  const plan = effectivePlan(date);
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const hasOpenOrder = db.prepare(
    `SELECT 1 FROM orders WHERE branch_id = ? AND status IN ('sent', 'accepted') AND created_at >= ?`
  );
  const usersFor = db.prepare(
    `SELECT u.id FROM users u JOIN branches b ON b.id = ?
     WHERE u.active = 1 AND ((u.role = 'staff' AND u.branch_id = b.id) OR (u.role = 'owner' AND u.customer_id = b.customer_id))`
  );

  let branches = 0;
  let users = 0;
  let skipped = 0;
  for (const route of plan.routes) {
    for (const stop of route.stops) {
      if (hasOpenOrder.get(stop.branchId, since)) {
        skipped++;
        continue;
      }
      const ids = usersFor.all(stop.branchId).map((r) => r.id);
      if (ids.length === 0) continue;
      branches++;
      users += notifyUsers(ids, 'reminder', { branch: stop.branchName }, '/order');
    }
  }
  return { date, branches, users, skipped };
}

// Called every minute: once the set time has passed, send tomorrow's reminders (once per day).
export function reminderTick() {
  const settings = reminderSettings();
  if (!settings.enabled) return;
  const now = berlinNow();
  if (now.time < settings.time) return;
  const target = addDays(now.date, 1);
  if (getSetting('reminder_last_run') === target) return;
  setSetting('reminder_last_run', target);
  const result = sendReminders(target);
  console.log(`Reminders for ${target}: ${result.users} people at ${result.branches} restaurants (${result.skipped} already ordered)`);
}
