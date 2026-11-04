import { Router } from 'express';
import { db, transaction } from '../db.js';
import { HttpError, cleanStr } from '../util.js';

// Products and categories. Mounted behind requireRole('admin').
const router = Router();

const PRODUCT_COLS = `p.id, p.name, p.category_id AS categoryId, c.name AS categoryName, p.article_no AS articleNo,
  p.unit, p.sizes, p.active, p.updated_at AS updatedAt`;
const toProduct = (p) => p && { ...p, active: Boolean(p.active) };
const getProduct = (id) =>
  toProduct(db.prepare(`SELECT ${PRODUCT_COLS} FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`).get(id));
const NOW = () => new Date().toISOString();

// Finds a category by name, creating it if needed. Returns its id, or null for "no category".
function categoryIdFor(name) {
  const clean = cleanStr(name, 80);
  if (!clean) return null;
  const found = db.prepare('SELECT id FROM categories WHERE name = ?').get(clean);
  if (found) return found.id;
  const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM categories').get().n;
  return Number(db.prepare('INSERT INTO categories (name, sort) VALUES (?, ?)').run(clean, sort).lastInsertRowid);
}

function readProduct(body) {
  const name = cleanStr(body.name, 120);
  if (!name) throw new HttpError(400, 'name_required');
  let categoryId = null;
  if (body.categoryId) {
    categoryId = Number(body.categoryId);
    if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(categoryId)) throw new HttpError(400, 'bad_request');
  } else if (body.categoryName) {
    categoryId = categoryIdFor(body.categoryName);
  }
  return {
    name,
    categoryId,
    articleNo: cleanStr(body.articleNo, 40),
    unit: cleanStr(body.unit, 30),
    sizes: cleanStr(body.sizes, 150),
    active: body.active !== false,
  };
}

function assertArticleNoFree(articleNo, exceptId = 0) {
  if (articleNo && db.prepare('SELECT 1 FROM products WHERE article_no = ? AND id <> ?').get(articleNo, exceptId))
    throw new HttpError(409, 'article_no_taken');
}

// ---------- Products ----------

router.get('/products', (req, res) => {
  const where = [];
  const params = [];
  const q = cleanStr(req.query.q, 100);
  if (q) {
    where.push('(p.name LIKE ? OR p.article_no LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (req.query.categoryId === 'none') where.push('p.category_id IS NULL');
  else if (req.query.categoryId) {
    where.push('p.category_id = ?');
    params.push(Number(req.query.categoryId));
  }
  if (req.query.status === 'active') where.push('p.active = 1');
  if (req.query.status === 'hidden') where.push('p.active = 0');

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM products p ${clause}`).get(...params).n;
  const products = db
    .prepare(
      `SELECT ${PRODUCT_COLS} FROM products p LEFT JOIN categories c ON c.id = p.category_id ${clause}
       ORDER BY p.name COLLATE NOCASE LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset)
    .map(toProduct);
  res.json({ total, products });
});

router.post('/products', (req, res) => {
  const p = transaction(() => {
    const p = readProduct(req.body);
    assertArticleNoFree(p.articleNo);
    return p;
  });
  const id = Number(
    db.prepare('INSERT INTO products (name, category_id, article_no, unit, sizes, active) VALUES (?, ?, ?, ?, ?, ?)')
      .run(p.name, p.categoryId, p.articleNo, p.unit, p.sizes, p.active ? 1 : 0).lastInsertRowid
  );
  res.status(201).json({ product: getProduct(id) });
});

router.patch('/products/:id', (req, res) => {
  const existing = getProduct(Number(req.params.id));
  if (!existing) throw new HttpError(404, 'not_found');
  const p = transaction(() => {
    const p = readProduct({ ...existing, categoryName: undefined, ...req.body });
    assertArticleNoFree(p.articleNo, existing.id);
    return p;
  });
  db.prepare('UPDATE products SET name = ?, category_id = ?, article_no = ?, unit = ?, sizes = ?, active = ?, updated_at = ? WHERE id = ?')
    .run(p.name, p.categoryId, p.articleNo, p.unit, p.sizes, p.active ? 1 : 0, NOW(), existing.id);
  res.json({ product: getProduct(existing.id) });
});

// Old orders keep the product name, so deleting a product is safe.
router.delete('/products/:id', (req, res) => {
  const { changes } = db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
  if (!changes) throw new HttpError(404, 'not_found');
  res.status(204).end();
});

// Bulk import from the Excel/CSV list. Rows are matched by article number when present,
// otherwise by name. Existing products are updated, new ones created.
router.post('/products/import', (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (rows.length === 0 || rows.length > 2000) throw new HttpError(400, 'bad_request');

  const result = { created: 0, updated: 0, unchanged: 0, skipped: 0 };
  transaction(() => {
    const byArticle = db.prepare('SELECT id, name, category_id, unit, sizes FROM products WHERE article_no = ?');
    const byName = db.prepare(`SELECT id, name, category_id, unit, sizes FROM products WHERE name = ? COLLATE NOCASE AND article_no = ''`);
    const insert = db.prepare('INSERT INTO products (name, category_id, article_no, unit, sizes) VALUES (?, ?, ?, ?, ?)');
    const update = db.prepare('UPDATE products SET name = ?, category_id = ?, unit = ?, sizes = ?, updated_at = ? WHERE id = ?');

    for (const row of rows) {
      const name = cleanStr(String(row.name ?? ''), 120);
      if (!name) {
        result.skipped++;
        continue;
      }
      const articleNo = cleanStr(String(row.articleNo ?? ''), 40);
      const unit = cleanStr(String(row.unit ?? ''), 30);
      const sizes = cleanStr(String(row.sizes ?? ''), 150);
      const categoryId = categoryIdFor(String(row.category ?? ''));
      const existing = articleNo ? byArticle.get(articleNo) : byName.get(name);

      if (!existing) {
        insert.run(name, categoryId, articleNo, unit, sizes);
        result.created++;
      } else {
        // Keep the current value when the file leaves a column empty.
        const next = { name, categoryId: categoryId ?? existing.category_id, unit: unit || existing.unit, sizes: sizes || existing.sizes };
        const same = ['name', 'unit', 'sizes'].every((k) => next[k] === existing[k]) && next.categoryId === existing.category_id;
        if (same) {
          result.unchanged++;
        } else {
          update.run(next.name, next.categoryId, next.unit, next.sizes, NOW(), existing.id);
          result.updated++;
        }
      }
    }
  });
  res.json(result);
});

// ---------- Categories ----------

router.get('/categories', (req, res) => {
  const categories = db
    .prepare(
      `SELECT c.id, c.name, c.sort, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS productCount
       FROM categories c ORDER BY c.sort, c.name COLLATE NOCASE`
    )
    .all();
  const uncategorized = db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id IS NULL').get().n;
  res.json({ categories, uncategorized });
});

router.post('/categories', (req, res) => {
  const name = cleanStr(req.body.name, 80);
  if (!name) throw new HttpError(400, 'name_required');
  if (db.prepare('SELECT 1 FROM categories WHERE name = ?').get(name)) throw new HttpError(409, 'category_exists');
  res.status(201).json({ id: categoryIdFor(name) });
});

router.patch('/categories/:id', (req, res) => {
  const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(Number(req.params.id));
  if (!cat) throw new HttpError(404, 'not_found');
  const name = cleanStr(req.body.name, 80);
  if (!name) throw new HttpError(400, 'name_required');
  if (db.prepare('SELECT 1 FROM categories WHERE name = ? AND id <> ?').get(name, cat.id)) throw new HttpError(409, 'category_exists');
  db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, cat.id);
  res.status(204).end();
});

// Moves a category one place up or down in the list customers see.
router.post('/categories/:id/move', (req, res) => {
  const list = db.prepare('SELECT id FROM categories ORDER BY sort, name COLLATE NOCASE').all().map((c) => c.id);
  const index = list.indexOf(Number(req.params.id));
  if (index === -1) throw new HttpError(404, 'not_found');
  const target = index + (req.body.direction === 'up' ? -1 : 1);
  if (target >= 0 && target < list.length) {
    [list[index], list[target]] = [list[target], list[index]];
    transaction(() => {
      const set = db.prepare('UPDATE categories SET sort = ? WHERE id = ?');
      list.forEach((id, i) => set.run(i + 1, id));
    });
  }
  res.status(204).end();
});

// Products in a deleted category become "without category"; they are not deleted.
router.delete('/categories/:id', (req, res) => {
  const { changes } = db.prepare('DELETE FROM categories WHERE id = ?').run(Number(req.params.id));
  if (!changes) throw new HttpError(404, 'not_found');
  res.status(204).end();
});

export default router;
