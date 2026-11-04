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

const PORT = Number(process.env.PORT) || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(here, '..', '..', 'client', 'dist');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');

app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  req.body ??= {};
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  next();
});
app.use(loadUser);

app.use('/api', authRoutes);
app.use('/api', voiceRoutes);
app.use('/api', customerRoutes);
app.use('/api/admin', requireRole('admin'), adminRoutes, adminCatalogRoutes, adminOrderRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

// After `npm run build`, the server also serves the app itself.
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/{*path}', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_request' });
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

cleanupVoice();
setInterval(cleanupVoice, 24 * 60 * 60 * 1000).unref();

app.listen(PORT, () => console.log(`SRJ server running on http://localhost:${PORT}`));
