import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { HttpError, cleanStr } from '../util.js';
import { notifyUsers, publicKey } from '../notify.js';
import { isDate } from '../plans.js';
import { reminderSettings, sendReminders } from '../reminders.js';
import { setSetting } from '../db.js';

const router = Router();

// ---------- Push subscriptions ----------

router.get('/push/key', requireAuth, (req, res) => res.json({ publicKey }));

router.post('/push/subscribe', requireAuth, (req, res) => {
  const endpoint = cleanStr(req.body.endpoint, 1000);
  const p256dh = cleanStr(req.body.keys?.p256dh, 200);
  const auth = cleanStr(req.body.keys?.auth, 100);
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) throw new HttpError(400, 'bad_request');
  // The same phone may be used by another person later: the subscription moves to the current user.
  db.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  ).run(req.user.id, endpoint, p256dh, auth, cleanStr(req.headers['user-agent'], 200));
  res.status(204).end();
});

router.post('/push/unsubscribe', requireAuth, (req, res) => {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(String(req.body.endpoint || ''), req.user.id);
  res.status(204).end();
});

router.post('/push/test', requireAuth, (req, res) => {
  notifyUsers([req.user.id], 'test', {}, '/notifications');
  res.status(204).end();
});

// ---------- In-app list ----------

router.get('/notifications/count', requireAuth, (req, res) => {
  res.json({ unread: db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(req.user.id).n });
});

router.get('/notifications', requireAuth, (req, res) => {
  const notifications = db
    .prepare(
      `SELECT id, kind, title, body, url, created_at AS createdAt, read_at AS readAt
       FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100`
    )
    .all(req.user.id);
  res.json({ notifications });
});

router.post('/notifications/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(new Date().toISOString(), req.user.id);
  res.status(204).end();
});

// ---------- Reminder settings (admin) ----------

router.get('/admin/reminders', requireRole('admin'), (req, res) => res.json({ settings: reminderSettings() }));

router.put('/admin/reminders', requireRole('admin'), (req, res) => {
  const time = String(req.body.time ?? '');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new HttpError(400, 'invalid_time');
  setSetting('reminder', { enabled: Boolean(req.body.enabled), time });
  res.json({ settings: reminderSettings() });
});

// Send the reminders for one delivery date right now.
router.post('/admin/reminders/send', requireRole('admin'), (req, res) => {
  if (!isDate(req.body.date)) throw new HttpError(400, 'bad_request');
  res.json(sendReminders(req.body.date));
});

export default router;
