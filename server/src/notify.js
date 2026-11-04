import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import { db, dataDir } from './db.js';

// Notifications: every message is saved for the in-app list (bell) and,
// where the user allowed it, also sent as a push notification to their phone.

// ---------- Push keys (VAPID) ----------
// Taken from the environment in production; otherwise created once and kept in data/vapid.json.
function loadKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const file = path.join(dataDir, 'vapid.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(file, JSON.stringify(keys, null, 2), { mode: 0o600 });
  console.log('Created push notification keys in', file);
  return keys;
}

const keys = loadKeys();
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@localhost', keys.publicKey, keys.privateKey);
export const publicKey = keys.publicKey;

// ---------- Texts ----------
// English only for now; add 'de' / 'hi' here later. Missing languages fall back to English.
const TEXTS = {
  en: {
    newOrder: { title: 'New order #{id}', body: '{customer} · {branch} · {items} items' },
    accepted: { title: 'Order #{id} accepted', body: 'SRJ has accepted your order.' },
    newBill: { title: 'New bill {number}', body: '{amount} · {customer}' },
    reminder: { title: 'Delivery tomorrow', body: 'Tomorrow is your delivery day ({branch}). Please send your order today.' },
    test: { title: 'Notifications work', body: 'This is a test from the SRJ app.' },
  },
};

function render(kind, lang, vars) {
  const text = TEXTS[lang]?.[kind] ?? TEXTS.en[kind];
  const fill = (s) => s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return { title: fill(text.title), body: fill(text.body) };
}

// ---------- Sending ----------

async function push(userId, message) {
  const subs = db.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').all(userId);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(message),
          { TTL: 24 * 60 * 60 }
        );
      } catch (err) {
        // 404/410: the phone unsubscribed or the app was removed.
        if (err.statusCode === 404 || err.statusCode === 410) db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id);
        else console.warn('Push failed:', err.statusCode || err.message);
      }
    })
  );
}

// Saves and sends one notification kind to a list of users (blocked users are skipped).
export function notifyUsers(userIds, kind, vars, url) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return 0;
  const users = db
    .prepare(`SELECT id, language FROM users WHERE active = 1 AND id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids);
  const insert = db.prepare('INSERT INTO notifications (user_id, kind, title, body, url) VALUES (?, ?, ?, ?, ?)');
  for (const u of users) {
    const text = render(kind, u.language, vars);
    const id = Number(insert.run(u.id, kind, text.title, text.body, url).lastInsertRowid);
    push(u.id, { ...text, url, tag: `${kind}-${id}` }).catch(() => {});
  }
  return users.length;
}

const idsOf = (sql, ...params) => db.prepare(sql).all(...params).map((r) => r.id);

export const adminIds = () => idsOf(`SELECT id FROM users WHERE role = 'admin' AND active = 1`);
export const ownerIds = (customerId) =>
  idsOf(`SELECT id FROM users WHERE role = 'owner' AND active = 1 AND customer_id = ?`, customerId);

// Keeps the in-app list short: remove read notifications older than 60 days.
export function cleanupNotifications() {
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM notifications WHERE read_at IS NOT NULL AND created_at < ?').run(cutoff);
}
