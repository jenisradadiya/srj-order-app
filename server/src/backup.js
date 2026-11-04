import fs from 'node:fs';
import path from 'node:path';
import { db, dataDir } from './db.js';

// A daily copy of the database in data/backups (the last 14 are kept).
// Voice messages and bill PDFs live next to it in data/, so copying the whole
// data folder to another place regularly (see docs/DEPLOY.md) backs up everything.

const backupDir = path.join(dataDir, 'backups');
const KEEP = 14;

export function backupDatabase() {
  fs.mkdirSync(backupDir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(backupDir, `srj-${day}.db`);
  if (fs.existsSync(file)) return file;
  // VACUUM INTO writes a clean, consistent copy even while the app is running.
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const old = fs.readdirSync(backupDir).filter((f) => /^srj-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -KEEP);
  for (const f of old) fs.rmSync(path.join(backupDir, f), { force: true });
  return file;
}
