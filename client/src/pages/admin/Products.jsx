import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { invalidateCatalog } from '../../lib/catalog.js';
import { ErrorText, Field, Icon, Modal, Spinner } from '../../components/ui.jsx';

const PAGE = 100;

export default function Products() {
  const { t, te } = useI18n();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState({ categories: [], uncategorized: 0 });
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const [showCategories, setShowCategories] = useState(false);

  const loadCategories = useCallback(() => {
    api('/admin/categories').then(setCategories).catch((err) => setError(te(err.code)));
  }, [te]);

  const load = useCallback(
    async (offset = 0) => {
      const qs = new URLSearchParams({ limit: PAGE, offset });
      if (query.trim()) qs.set('q', query.trim());
      if (categoryId) qs.set('categoryId', categoryId);
      if (status) qs.set('status', status);
      try {
        const next = await api(`/admin/products?${qs}`);
        setError('');
        setData((prev) => (offset ? { ...next, products: [...prev.products, ...next.products] } : next));
      } catch (err) {
        setError(te(err.code));
      }
    },
    [query, categoryId, status, te]
  );

  useEffect(() => {
    const timer = setTimeout(() => load(), 200);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const changed = () => {
    invalidateCatalog();
    load();
    loadCategories();
  };

  return (
    <div className="page">
      <div className="section-head">
        <h1>{t('products.title')} {data && <span className="muted">({data.total})</span>}</h1>
        <div className="row-actions">
          <button className="btn small" onClick={() => setShowCategories(true)}>
            <Icon name="tag" size={16} /> {t('products.categories')}
          </button>
          <Link className="btn small" to="/admin/products/import">
            <Icon name="upload" size={16} /> {t('products.import')}
          </Link>
          <button className="btn primary small" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> {t('products.add')}
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="search grow">
          <Icon name="search" />
          <input type="search" placeholder={t('products.search')} aria-label={t('products.search')}
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label={t('products.category')}>
          <option value="">{t('products.allCategories')}</option>
          {categories.categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.productCount})</option>)}
          {categories.uncategorized > 0 && <option value="none">{t('order.otherCategory')} ({categories.uncategorized})</option>}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('products.visibility')}>
          <option value="">{t('products.allStatus')}</option>
          <option value="active">{t('products.visible')}</option>
          <option value="hidden">{t('products.hidden')}</option>
        </select>
      </div>

      <ErrorText>{error}</ErrorText>
      {!data && !error && <Spinner />}
      {data?.total === 0 && !query && !categoryId && !status && (
        <div className="card center stack">
          <p>{t('products.emptyIntro')}</p>
          <Link className="btn primary" to="/admin/products/import"><Icon name="upload" /> {t('products.import')}</Link>
        </div>
      )}
      {data?.total === 0 && (query || categoryId || status) && <p className="muted center">{t('products.noMatch')}</p>}

      {data?.products.length > 0 && (
        <ul className="plain-list card product-admin-list">
          {data.products.map((p) => (
            <li key={p.id}>
              <button className={`product-admin-row ${p.active ? '' : 'inactive'}`} onClick={() => setEditing(p)}>
                <span className="grow">
                  <strong>{p.name}</strong>
                  {!p.active && <span className="badge">{t('products.hidden')}</span>}
                  <span className="muted small block">
                    {p.categoryName || t('order.otherCategory')}
                    {p.unit && ` · ${p.unit}`}
                    {p.articleNo && ` · ${t('products.articleNoShort')} ${p.articleNo}`}
                  </span>
                </span>
                <Icon name="edit" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {data && data.products.length < data.total && (
        <button className="btn" onClick={() => load(data.products.length)}>
          {t('common.loadMore')} ({data.products.length} / {data.total})
        </button>
      )}

      {editing && (
        <ProductForm product={editing === 'new' ? null : editing} categories={categories.categories}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); changed(); }} />
      )}
      {showCategories && (
        <CategoriesDialog data={categories} onChanged={changed} onClose={() => setShowCategories(false)} />
      )}
    </div>
  );
}

function ProductForm({ product, categories, onClose, onSaved }) {
  const { t, te } = useI18n();
  const [form, setForm] = useState({
    name: product?.name ?? '',
    categoryName: product?.categoryName ?? '',
    unit: product?.unit ?? '',
    articleNo: product?.articleNo ?? '',
    active: product?.active ?? true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    // categoryId null + categoryName: the server finds the category by name or creates it.
    const body = { ...form, categoryId: null };
    try {
      if (product) await api(`/admin/products/${product.id}`, { method: 'PATCH', body });
      else await api('/admin/products', { method: 'POST', body });
      onSaved();
    } catch (err) {
      setError(te(err.code));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(t('products.deleteConfirm', { name: product.name }))) return;
    try {
      await api(`/admin/products/${product.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err) {
      setError(te(err.code));
    }
  };

  return (
    <Modal title={product ? t('products.edit') : t('products.add')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label={t('fields.name')}>
          <input required value={form.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label={t('products.category')} hint={t('products.categoryHint')}>
          <input list="category-names" value={form.categoryName} onChange={set('categoryName')} />
          <datalist id="category-names">
            {categories.map((c) => <option key={c.id} value={c.name} />)}
          </datalist>
        </Field>
        <div className="field-row even">
          <Field label={`${t('products.unit')} (${t('common.optional')})`}>
            <input value={form.unit} onChange={set('unit')} placeholder={t('products.unitPlaceholder')} />
          </Field>
          <Field label={`${t('products.articleNo')} (${t('common.optional')})`}>
            <input value={form.articleNo} onChange={set('articleNo')} />
          </Field>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={form.active} onChange={set('active')} />
          <span>
            <strong>{t('products.visibleToCustomers')}</strong>
            <span className="muted small block">{t('products.visibleHint')}</span>
          </span>
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="actions">
          {product && (
            <button type="button" className="btn danger" onClick={remove}>
              <Icon name="trash" size={18} /> {t('common.delete')}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={busy}>{t('common.save')}</button>
        </div>
      </form>
    </Modal>
  );
}

function CategoriesDialog({ data, onChanged, onClose }) {
  const { t, te } = useI18n();
  const [newName, setNewName] = useState('');
  const [names, setNames] = useState({});
  const [error, setError] = useState('');

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(te(err.code));
    }
  };

  const add = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    run(async () => {
      await api('/admin/categories', { method: 'POST', body: { name: newName } });
      setNewName('');
    });
  };

  return (
    <Modal title={t('products.categories')} onClose={onClose}>
      <p className="muted small">{t('products.categoriesHint')}</p>
      <ErrorText>{error}</ErrorText>
      <ul className="plain-list category-admin-list">
        {data.categories.map((c, i) => {
          const name = names[c.id] ?? c.name;
          return (
            <li key={c.id} className="category-admin-row">
              <input value={name} aria-label={t('fields.name')} onChange={(e) => setNames({ ...names, [c.id]: e.target.value })} />
              <span className="muted small nowrap">{c.productCount}</span>
              {name !== c.name && (
                <button className="btn small primary" onClick={() => run(() => api(`/admin/categories/${c.id}`, { method: 'PATCH', body: { name } }))}>
                  {t('common.save')}
                </button>
              )}
              <button className="icon-btn" disabled={i === 0} aria-label={t('products.moveUp')}
                onClick={() => run(() => api(`/admin/categories/${c.id}/move`, { method: 'POST', body: { direction: 'up' } }))}>
                <Icon name="up" size={18} />
              </button>
              <button className="icon-btn" disabled={i === data.categories.length - 1} aria-label={t('products.moveDown')}
                onClick={() => run(() => api(`/admin/categories/${c.id}/move`, { method: 'POST', body: { direction: 'down' } }))}>
                <Icon name="down" size={18} />
              </button>
              <button className="icon-btn danger" aria-label={`${t('common.delete')}: ${c.name}`}
                onClick={() => confirm(t('products.deleteCategoryConfirm', { name: c.name, count: c.productCount })) &&
                  run(() => api(`/admin/categories/${c.id}`, { method: 'DELETE' }))}>
                <Icon name="trash" size={18} />
              </button>
            </li>
          );
        })}
      </ul>
      <form className="inline-form" onSubmit={add}>
        <input placeholder={t('products.newCategory')} aria-label={t('products.newCategory')} value={newName}
          onChange={(e) => setNewName(e.target.value)} />
        <button className="btn primary"><Icon name="plus" size={18} /> {t('common.add')}</button>
      </form>
    </Modal>
  );
}
