import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { ErrorText, Icon, Spinner } from '../../components/ui.jsx';
import { CustomerForm } from '../../components/admin/CustomerForms.jsx';
import { formatMoney } from '../../lib/money.js';

export default function Customers() {
  const { t, te, lang } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState('');
  const adding = params.get('new') === '1';

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      api(`/admin/customers?q=${encodeURIComponent(query)}`)
        .then((data) => !cancelled && setCustomers(data.customers))
        .catch((err) => !cancelled && setError(te(err.code)));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, te]);

  return (
    <div className="page">
      <div className="section-head">
        <h1>{t('customers.title')}</h1>
        <button className="btn primary" onClick={() => setParams({ new: '1' })}>
          <Icon name="plus" /> {t('customers.add')}
        </button>
      </div>

      <div className="search">
        <Icon name="search" />
        <input type="search" placeholder={t('customers.search')} aria-label={t('customers.search')}
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <ErrorText>{error}</ErrorText>
      {!customers && !error && <Spinner />}
      {customers?.length === 0 && (
        <p className="muted center">{query ? t('customers.noMatch') : t('customers.empty')}</p>
      )}

      <ul className="plain-list customer-list">
        {customers?.map((c) => (
          <li key={c.id}>
            <Link to={`/admin/customers/${c.id}`} className="customer-card">
              <div>
                <strong>{c.name}</strong>
                <div className="muted small">
                  {t('customers.branchCount', { count: c.branchCount })} · {t('customers.userCount', { count: c.userCount })}
                  {c.cities.length > 0 && ` · ${c.cities.join(', ')}`}
                </div>
              </div>
              {c.openAmount > 0 && (
                <span className="open-badge" title={t('bills.totalOpen')}>{formatMoney(c.openAmount, lang)}</span>
              )}
              <Icon name="chevron" />
            </Link>
          </li>
        ))}
      </ul>

      {adding && (
        <CustomerForm onClose={() => setParams({})} onSaved={({ id }) => navigate(`/admin/customers/${id}`)} />
      )}
    </div>
  );
}
