import { Router } from 'express';
import { db } from '../db.js';
import {
  createSession, destroySession, endAllSessions, hashPin, checkPin, DUMMY_HASH, requireAuth, userProfile,
} from '../auth.js';
import { HttpError, cleanStr, normalizePhone, isValidPin, LANGUAGES } from '../util.js';

const router = Router();

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const userCount = () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n;

// First start: no users yet, so the first person creates the first admin.
router.get('/setup/status', (req, res) => {
  res.json({ needsSetup: userCount() === 0 });
});

router.post('/setup', (req, res) => {
  if (userCount() > 0) throw new HttpError(403, 'setup_done');
  const name = cleanStr(req.body.name, 80);
  const phone = normalizePhone(req.body.phone);
  const pin = String(req.body.pin ?? '');
  if (!name) throw new HttpError(400, 'name_required');
  if (!phone) throw new HttpError(400, 'invalid_phone');
  if (!isValidPin(pin)) throw new HttpError(400, 'invalid_pin');
  const language = LANGUAGES.includes(req.body.language) ? req.body.language : 'de';

  const { lastInsertRowid } = db
    .prepare(`INSERT INTO users (name, phone, pin_hash, role, language) VALUES (?, ?, ?, 'admin', ?)`)
    .run(name, phone, hashPin(pin), language);
  const id = Number(lastInsertRowid);
  createSession(req, res, id);
  res.status(201).json({ user: userProfile(id) });
});

// Besides the per-number lock, limit attempts per device/network,
// so nobody can try PINs across many phone numbers.
const ATTEMPT_WINDOW = 15 * 60 * 1000;
const MAX_PER_IP = 30;
const attemptsByIp = new Map();

function checkIpLimit(ip) {
  const now = Date.now();
  const entry = attemptsByIp.get(ip);
  if (!entry || entry.resetAt < now) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + ATTEMPT_WINDOW });
    if (attemptsByIp.size > 10000) for (const [k, v] of attemptsByIp) if (v.resetAt < now) attemptsByIp.delete(k);
    return;
  }
  entry.count++;
  if (entry.count > MAX_PER_IP) throw new HttpError(429, 'locked');
}

router.post('/auth/login', (req, res) => {
  checkIpLimit(req.ip);
  const phone = normalizePhone(req.body.phone);
  const pin = String(req.body.pin ?? '');
  if (!phone || !isValidPin(pin)) throw new HttpError(401, 'login_failed');

  const user = db.prepare('SELECT id, pin_hash, active, failed_attempts, locked_until FROM users WHERE phone = ?').get(phone);
  if (!user) {
    checkPin(pin, DUMMY_HASH);
    throw new HttpError(401, 'login_failed');
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) throw new HttpError(429, 'locked');

  if (!checkPin(pin, user.pin_hash)) {
    const attempts = user.failed_attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      const until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?').run(until, user.id);
      throw new HttpError(429, 'locked');
    }
    db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(attempts, user.id);
    throw new HttpError(401, 'login_failed');
  }
  if (!user.active) throw new HttpError(403, 'account_inactive');

  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?')
    .run(new Date().toISOString(), user.id);
  createSession(req, res, user.id);
  res.json({ user: userProfile(user.id) });
});

router.post('/auth/logout', (req, res) => {
  destroySession(req, res);
  res.status(204).end();
});

router.get('/auth/me', (req, res) => {
  res.json({ user: req.user ? userProfile(req.user.id) : null });
});

router.patch('/me', requireAuth, (req, res) => {
  if (!LANGUAGES.includes(req.body.language)) throw new HttpError(400, 'bad_request');
  db.prepare('UPDATE users SET language = ? WHERE id = ?').run(req.body.language, req.user.id);
  res.json({ user: userProfile(req.user.id) });
});

router.post('/me/pin', requireAuth, (req, res) => {
  const { currentPin, newPin } = req.body;
  if (!isValidPin(newPin)) throw new HttpError(400, 'invalid_pin');
  const { pin_hash } = db.prepare('SELECT pin_hash FROM users WHERE id = ?').get(req.user.id);
  if (!isValidPin(currentPin) || !checkPin(String(currentPin), pin_hash)) throw new HttpError(400, 'wrong_pin');
  db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(String(newPin)), req.user.id);
  endAllSessions(req.user.id, req.sessionId); // log out other phones
  res.status(204).end();
});

export default router;
