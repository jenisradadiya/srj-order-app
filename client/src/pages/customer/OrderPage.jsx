import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/index.jsx';
import { useDraft } from '../../lib/draft.jsx';
import { searchProducts, useCatalog } from '../../lib/catalog.js';
import { ErrorText, Icon, Spinner } from '../../components/ui.jsx';
import ItemSheet from '../../components/ItemSheet.jsx';

const FREQUENT = 'frequent';
const NONE = 'none'; // products without a category

// Pick products: search, or browse by category. Tapping a product opens a sheet
// for quantity, note and voice. The same product can be added several times
// (e.g. two different rice brands).
export default function OrderPage() {
  const { t, te } = useI18n();
  const { data, error, reload } = useCatalog();
  const { draft, itemCount, addItem } = useDraft();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null); // null = overview, FREQUENT, or a category id
  const [sheet, setSheet] = useState(null); // { product } | { custom: true }

  const countByProduct = useMemo(() => {
    const map = new Map();
    for (const it of draft.items) if (it.productId) map.set(it.productId, (map.get(it.productId) || 0) + 1);
    return map;
  }, [draft.items]);

  const visible = useMemo(() => {
    if (!data) return [];
    if (query.trim()) return searchProducts(data.products, query);
    if (category === FREQUENT) return data.frequent.map((id) => data.productById.get(id)).filter(Boolean);
    if (category === NONE) return data.products.filter((p) => p.categoryId === null);
    if (category !== null) return data.products.filter((p) => p.categoryId === category);
    return [];
  }, [data, query, category]);

  const categoryCounts = useMemo(() => {
    const map = new Map();
    for (const p of data?.products ?? []) map.set(p.categoryId, (map.get(p.categoryId) || 0) + 1);
    return map;
  }, [data]);

  if (!data) {
    return (
      <div className="page narrow">
        {error ? (
          <>
            <ErrorText>{te(error)}</ErrorText>
            <button className="btn" onClick={reload}>{t('common.retry')}</button>
          </>
        ) : (
          <Spinner />
        )}
      </div>
    );
  }

  const searching = Boolean(query.trim());
  const categoryName =
    category === FREQUENT ? t('order.frequent') : data.categories.find((c) => c.id === category)?.name ?? t('order.otherCategory');
  const uncategorized = categoryCounts.get(null) || 0;

  return (
    <div className="page narrow order-page">
      <h1>{t('order.title')}</h1>

      <div className="search sticky-search">
        <Icon name="search" />
        <input type="search" placeholder={t('order.search')} aria-label={t('order.search')} value={query}
          onChange={(e) => setQuery(e.target.value)} />
      </div>

      {!searching && category !== null && (
        <button className="back-link" onClick={() => setCategory(null)}>
          <Icon name="back" size={18} /> {t('order.allCategories')}
        </button>
      )}

      {!searching && category === null && (
        <>
          <div className="category-grid">
            {data.frequent.length > 0 && (
              <button className="category-tile frequent" onClick={() => setCategory(FREQUENT)}>
                <Icon name="repeat" />
                <strong>{t('order.frequent')}</strong>
                <span className="muted small">{data.frequent.length}</span>
              </button>
            )}
            {data.categories.filter((c) => categoryCounts.get(c.id)).map((c) => (
              <button key={c.id} className="category-tile" onClick={() => setCategory(c.id)}>
                <strong>{c.name}</strong>
                <span className="muted small">{categoryCounts.get(c.id)}</span>
              </button>
            ))}
            {uncategorized > 0 && (
              <button className="category-tile" onClick={() => setCategory(NONE)}>
                <strong>{t('order.otherCategory')}</strong>
                <span className="muted small">{uncategorized}</span>
              </button>
            )}
          </div>
          {data.products.length === 0 && <p className="muted center">{t('order.noProducts')}</p>}
        </>
      )}

      {(searching || category !== null) && (
        <section>
          {!searching && <h2>{categoryName}</h2>}
          {visible.length === 0 && <p className="muted">{searching ? t('order.noMatch') : t('order.noProducts')}</p>}
          <ul className="plain-list product-list">
            {visible.map((p) => (
              <li key={p.id}>
                <button className={`product-row ${countByProduct.get(p.id) ? 'in-cart' : ''}`} onClick={() => setSheet({ product: p })}>
                  <span className="product-name">
                    {p.name}
                    {p.unit && <span className="muted small"> · {p.unit}</span>}
                    {p.sizes && <span className="product-sizes muted small">{p.sizes}</span>}
                  </span>
                  {countByProduct.get(p.id) ? (
                    <span className="in-cart-badge"><Icon name="check" size={14} /> {countByProduct.get(p.id)}</span>
                  ) : (
                    <span className="add-icon" aria-hidden="true"><Icon name="plus" size={18} /></span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card custom-item-card">
        <div>
          <strong>{t('order.notFoundTitle')}</strong>
          <p className="muted small">{t('order.notFoundText')}</p>
        </div>
        <button className="btn" onClick={() => setSheet({ custom: true })}>
          <Icon name="plus" size={18} /> {t('item.addCustom')}
        </button>
      </section>

      {itemCount > 0 && (
        <Link to="/order/cart" className="cart-bar">
          <Icon name="cart" />
          <span>{t('order.cartCount', { count: itemCount })}</span>
          <strong>{t('order.toCart')} →</strong>
        </Link>
      )}

      {sheet && (
        <ItemSheet
          product={sheet.product}
          custom={sheet.custom}
          existingLines={sheet.product ? draft.items.filter((it) => it.productId === sheet.product.id) : []}
          onClose={() => setSheet(null)}
          onSave={(item) => {
            addItem(item);
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}
