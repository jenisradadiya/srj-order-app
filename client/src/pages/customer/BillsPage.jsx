import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { formatDay } from '../../lib/dates.js';
import { ErrorText, Icon, Spinner } from '../../components/ui.jsx';
import { BillStatus, useMoney } from '../../components/bills/BillParts.jsx';

const TABS = ['open', 'paid', 'all'];

// Owner: all bills of their restaurants, with open and paid totals.
export default function BillsPage() {
  const { t, te, lang } = useI18n();
  const { user } = useAuth();
  const money = useMoney();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('status')) ? params.get('status') : 'open';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api(`/invoices?status=${tab}&limit=200`));
    } catch (err) {
      setError(te(err.code));
    }
  }, [tab, te]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page narrow">
      <h1>{t('bills.myTitle')}</h1>
      <ErrorText>{error}</ErrorText>
      {!data && !error && <Spinner />}
      {data && (
        <>
          <div className="balance-grid">
            <div className="balance open"><span>{t('bills.totalOpen')}</span><strong>{money(data.totals.open)}</strong></div>
            <div className="balance"><span>{t('bills.totalPaid')}</span><strong>{money(data.totals.paid)}</strong></div>
          </div>
          <p className="muted small">{t('bills.billCounts', { open: data.totals.openCount, all: data.totals.count })}</p>

          <div className="tabs" role="tablist">
            {TABS.map((s) => (
              <button key={s} role="tab" aria-selected={tab === s} className={tab === s ? 'active' : ''}
                onClick={() => setParams(s === 'open' ? {} : { status: s })}>
                {t(`bills.tab.${s}`)}
              </button>
            ))}
          </div>

          {data.invoices.length === 0 && <p className="muted center">{tab === 'open' ? t('bills.nothingOpen') : t('bills.empty')}</p>}
          <ul className="plain-list customer-list">
            {data.invoices.map((inv) => (
              <li key={inv.id}>
                <Link to={`/bills/${inv.id}`} className={`customer-card bill-card bill-line-${inv.status}`}>
                  <div className="grow">
                    <div className="user-title"><strong>{inv.number}</strong><BillStatus status={inv.status} /></div>
                    <div className="muted small">
                      {formatDay(inv.date, lang, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {user.branches.length > 1 && inv.branchName && ` · ${inv.branchName}`}
                    </div>
                  </div>
                  <div className="bill-money">
                    <strong>{money(inv.amount)}</strong>
                    {inv.status === 'partial' && <span className="muted small">{t('bills.openAmount', { amount: money(inv.open) })}</span>}
                  </div>
                  <Icon name="chevron" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
