import { Router, raw } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, dataDir } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { HttpError } from '../util.js';

const router = Router();

export const voiceDir = path.join(dataDir, 'voice');
fs.mkdirSync(voiceDir, { recursive: true });

const MAX_BYTES = 8 * 1024 * 1024; // ~2-3 minutes of phone audio
// Only plain audio types are accepted, so a file can never be served back as a web page.
const ALLOWED = new Set([
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'audio/m4a',
  'audio/wav', 'audio/x-wav', 'audio/3gpp', 'audio/3gpp2', 'audio/amr', 'video/webm', 'video/mp4',
]);
const ID_PATTERN = /^[0-9a-f-]{36}$/;
const baseMime = (value) => String(value || '').split(';')[0].trim().toLowerCase();

const filePath = (id) => path.join(voiceDir, id);

// Upload a recording. It is linked to an order later, when the order is sent.
router.post(
  '/voice',
  requireRole('owner', 'staff'),
  raw({ type: () => true, limit: MAX_BYTES }),
  (req, res) => {
    const mime = baseMime(req.headers['content-type']);
    if (!ALLOWED.has(mime)) throw new HttpError(400, 'voice_invalid');
    if (!Buffer.isBuffer(req.body) || req.body.length < 100) throw new HttpError(400, 'voice_invalid');

    const id = crypto.randomUUID();
    const duration = Math.max(0, Math.min(600, Number(req.headers['x-duration']) || 0));
    fs.writeFileSync(filePath(id), req.body);
    db.prepare('INSERT INTO voice_messages (id, user_id, customer_id, mime, size, duration) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, req.user.id, req.user.customerId, mime, req.body.length, duration);
    res.status(201).json({ id, duration });
  }
);

router.get('/voice/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  if (!ID_PATTERN.test(id)) throw new HttpError(404, 'not_found');
  const voice = db.prepare('SELECT id, mime, customer_id FROM voice_messages WHERE id = ?').get(id);
  if (!voice) throw new HttpError(404, 'not_found');
  const isTeam = req.user.role === 'admin' || req.user.role === 'warehouse';
  if (!isTeam && voice.customer_id !== req.user.customerId) throw new HttpError(404, 'not_found');

  res.set('Content-Type', voice.mime);
  res.set('Content-Disposition', 'inline');
  res.set('Cache-Control', 'private, max-age=31536000, immutable');
  res.sendFile(filePath(voice.id)); // supports Range requests, so audio can be scrubbed
});

// Remove a recording that was not sent yet (e.g. recorded again).
router.delete('/voice/:id', requireRole('owner', 'staff'), (req, res) => {
  const { id } = req.params;
  if (!ID_PATTERN.test(id)) throw new HttpError(404, 'not_found');
  const voice = db.prepare('SELECT id, user_id, order_id FROM voice_messages WHERE id = ?').get(id);
  if (!voice || voice.user_id !== req.user.id) throw new HttpError(404, 'not_found');
  if (voice.order_id) throw new HttpError(409, 'voice_in_order');
  db.prepare('DELETE FROM voice_messages WHERE id = ?').run(id);
  fs.rmSync(filePath(id), { force: true });
  res.status(204).end();
});

// Recordings that never made it into an order are removed after 30 days.
export function cleanupVoice() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const stale = db.prepare('SELECT id FROM voice_messages WHERE order_id IS NULL AND created_at < ?').all(cutoff);
  for (const { id } of stale) {
    db.prepare('DELETE FROM voice_messages WHERE id = ?').run(id);
    fs.rmSync(filePath(id), { force: true });
  }
  if (stale.length) console.log(`Removed ${stale.length} unused voice messages`);
}

export default router;
