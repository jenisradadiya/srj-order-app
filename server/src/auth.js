import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { HttpError } from './util.js';

const COOKIE = 'srj_session';
const DAY = 24 * 60 * 60 * 1000;
const SESSION_DAYS = 180; // users stay logged in for months

export const hashPin = (pin) => bcrypt.hashSync(pin, 10);
export const checkPin = (pin, hash) => bcrypt.compareSync(pin, hash);
// Compared against when the phone number is unknown, so the response time
// does not reveal which numbers have accounts.
export const DUMMY_HASH = hashPin('0000');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function setCookie(req, res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: SESSION_DAYS * DAY,
    path: '/',
  });
}

function readToken(req) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function createSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), userId, expiresAt);
  setCookie(req, res, token);
}

export function destroySession(req, res) {
  if (req.sessionId) db.prepare('DELETE FROM sessions WHERE id = ?').run(req.sessionId);
  res.clearCookie(COOKIE, { path: '/' });
}

export const endAllSessions = (userId, exceptSessionId = '') =>
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').run(userId, exceptSessionId);

// Runs on every request: attaches req.user when a valid session cookie is present.
export function loadUser(req, res, next) {
  const token = readToken(req);
  if (token) {
    const sessionId = hashToken(token);
    const row = db
      .prepare(
        `SELECT s.expires_at, u.id, u.name, u.role, u.customer_id, u.branch_id, u.language, u.active
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
      )
      .get(sessionId);
    const expiresAt = row ? new Date(row.expires_at).getTime() : 0;
    if (row && row.active && expiresAt > Date.now()) {
      req.sessionId = sessionId;
      req.user = {
        id: row.id,
        name: row.name,
        role: row.role,
        customerId: row.customer_id,
        branchId: row.branch_id,
        language: row.language,
      };
      // Sliding expiry: refresh at most once a day.
      if (expiresAt - Date.now() < (SESSION_DAYS - 1) * DAY) {
        const next = new Date(Date.now() + SESSION_DAYS * DAY).toISOString();
        db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(next, sessionId);
        setCookie(req, res, token);
      }
    } else if (row) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) throw new HttpError(401, 'unauthorized');
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) throw new HttpError(401, 'unauthorized');
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'forbidden');
  next();
};

const BRANCH_COLS = 'id, customer_id AS customerId, name, street, postal_code AS postalCode, city, phone';

// What the logged-in user's own app needs to know about them.
export function userProfile(userId) {
  const u = db.prepare('SELECT id, name, phone, role, customer_id, branch_id, language FROM users WHERE id = ?').get(userId);
  if (!u) return null;
  const profile = { id: u.id, name: u.name, phone: u.phone, role: u.role, language: u.language, customer: null, branches: [] };
  if (u.customer_id) {
    profile.customer = db.prepare('SELECT id, name FROM customers WHERE id = ?').get(u.customer_id) ?? null;
    profile.branches =
      u.role === 'owner'
        ? db.prepare(`SELECT ${BRANCH_COLS} FROM branches WHERE customer_id = ? ORDER BY name COLLATE NOCASE`).all(u.customer_id)
        : db.prepare(`SELECT ${BRANCH_COLS} FROM branches WHERE id = ?`).all(u.branch_id ?? 0);
  }
  return profile;
}
