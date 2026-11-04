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

  // 2: products, orders, voice messages
  `
  CREATE TABLE categories (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL UNIQUE COLLATE NOCASE,
    sort  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE products (
    id           INTEGER PRIMARY KEY,
    name         TEXT NOT NULL,
    category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    article_no   TEXT NOT NULL DEFAULT '',
    unit         TEXT NOT NULL DEFAULT '',
    active       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL DEFAULT ${NOW},
    updated_at   TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX products_category ON products(category_id);
  CREATE UNIQUE INDEX products_article_no ON products(article_no) WHERE article_no <> '';

  -- Audio is stored as a file in data/voice/<id>; this row says who may play it.
  CREATE TABLE voice_messages (
    id           TEXT PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    customer_id  INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    mime         TEXT NOT NULL,
    size         INTEGER NOT NULL,
    duration     REAL NOT NULL DEFAULT 0,
    order_id     INTEGER,
    created_at   TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE orders (
    id           INTEGER PRIMARY KEY,
    client_ref   TEXT UNIQUE,
    customer_id  INTEGER NOT NULL REFERENCES customers(id),
    branch_id    INTEGER NOT NULL REFERENCES branches(id),
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name    TEXT NOT NULL,
    user_role    TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'delivered')),
    note         TEXT NOT NULL DEFAULT '',
    voice_id     TEXT REFERENCES voice_messages(id),
    created_at   TEXT NOT NULL DEFAULT ${NOW},
    accepted_at  TEXT,
    accepted_by  TEXT,
    delivered_at TEXT
  );
  CREATE INDEX orders_customer ON orders(customer_id, created_at);
  CREATE INDEX orders_branch ON orders(branch_id, created_at);
  CREATE INDEX orders_status ON orders(status, created_at);

  -- Names are copied into the order so old orders stay readable after a product changes.
  CREATE TABLE order_items (
    id            INTEGER PRIMARY KEY,
    order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    position      INTEGER NOT NULL,
    product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name  TEXT NOT NULL,
    unit          TEXT NOT NULL DEFAULT '',
    quantity      REAL NOT NULL,
    note          TEXT NOT NULL DEFAULT '',
    voice_id      TEXT REFERENCES voice_messages(id),
    is_custom     INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX order_items_order ON order_items(order_id);
  CREATE INDEX order_items_product ON order_items(product_id);
  `,
];

export { dataDir };

const { user_version: version } = db.prepare('PRAGMA user_version').get();
for (let v = version; v < migrations.length; v++) {
  transaction(() => {
    db.exec(migrations[v]);
    db.exec(`PRAGMA user_version = ${v + 1}`);
  });
  console.log(`Database migrated to version ${v + 1}`);
}
