import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(here, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'srj.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

// Each entry upgrades the database by one version. Never edit an existing
// entry once it has run; add a new one instead.
const migrations = [
  `
  CREATE TABLE customers (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE branches (
    id           INTEGER PRIMARY KEY,
    customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    street       TEXT NOT NULL DEFAULT '',
    postal_code  TEXT NOT NULL DEFAULT '',
    city         TEXT NOT NULL DEFAULT '',
    phone        TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX branches_customer ON branches(customer_id);

  CREATE TABLE users (
    id               INTEGER PRIMARY KEY,
    name             TEXT NOT NULL,
    phone            TEXT NOT NULL UNIQUE,
    pin_hash         TEXT NOT NULL,
    role             TEXT NOT NULL CHECK (role IN ('admin', 'warehouse', 'owner', 'staff')),
    customer_id      INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    branch_id        INTEGER REFERENCES branches(id),
    language         TEXT NOT NULL DEFAULT 'de',
    active           INTEGER NOT NULL DEFAULT 1,
    failed_attempts  INTEGER NOT NULL DEFAULT 0,
    locked_until     TEXT,
    last_login_at    TEXT,
    created_at       TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX users_customer ON users(customer_id);

  CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT ${NOW},
    expires_at  TEXT NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  `,
];

const { user_version: version } = db.prepare('PRAGMA user_version').get();
for (let v = version; v < migrations.length; v++) {
  transaction(() => {
    db.exec(migrations[v]);
    db.exec(`PRAGMA user_version = ${v + 1}`);
  });
  console.log(`Database migrated to version ${v + 1}`);
}
