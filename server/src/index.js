import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './db.js';
import { loadUser, requireRole } from './auth.js';
import { HttpError } from './util.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import adminCatalogRoutes from './routes/adminCatalog.js';
import adminOrderRoutes from './routes/adminOrders.js';
import customerRoutes from './routes/customer.js';
import voiceRoutes, { cleanupVoice } from './routes/voice.js';
import teamRoutes from './routes/team.js';
import adminRouteRoutes from './routes/adminRoutes.js';
import notificationRoutes from './routes/notifications.js';
import { adminInvoices, customerInvoices, cleanupInvoiceFiles } from './routes/invoices.js';
import { cleanupNotifications } from './notify.js';
import { reminderTick } from './reminders.js';
import { backupDatabase } from './backup.js';

const PORT = Number(process.env.PORT) || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(here, '..', '..', 'client', 'dist');

const app = express();
app.disable('x-powered-by');
// Behind a reverse proxy on the same machine (Caddy/nginx), so https is recognised.
app.set('trust proxy', 'loopback');

app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  req.body ??= {};
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  res.set('X-Frame-Options', 'DENY');
  next();
});
app.use(loadUser);

app.use('/api', authRoutes);
app.use('/api', voiceRoutes);
app.use('/api', customerRoutes);
app.use('/api', customerInvoices);
app.use('/api', notificationRoutes);
app.use('/api/team', requireRole('admin', 'warehouse'), teamRoutes);
app.use('/api/admin', requireRole('admin'), adminRoutes, adminCatalogRoutes, adminOrderRoutes, adminRouteRoutes, adminInvoices);
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

// After `npm run build`, the server also serves the app itself.
if (fs.existsSync(clientDist)) {
  app.use(
    express.static(clientDist, {
      setHeaders(res, file) {
        // Built files have a hash in their name and never change; the rest must always be fresh.
        if (file.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
        else res.set('Cache-Control', 'no-cache');
      },
    })
  );
  app.get('/{*path}', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_request' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

const daily = () => {
  try {
    backupDatabase();
    cleanupVoice();
    cleanupInvoiceFiles();
    cleanupNotifications();
  } catch (err) {
    console.error('Daily maintenance failed:', err);
  }
};
daily();
setInterval(daily, 6 * 60 * 60 * 1000).unref(); // a new backup is written once per day
setInterval(() => {
  try {
    reminderTick();
  } catch (err) {
    console.error('Reminder check failed:', err);
  }
}, 60 * 1000).unref();

app.listen(PORT, () => console.log(`SRJ server running on http://localhost:${PORT}`));
