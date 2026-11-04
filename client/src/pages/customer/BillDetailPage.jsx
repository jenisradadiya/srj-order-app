import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { formatDay } from '../../lib/dates.js';
import { ErrorText, Icon, Spinner } from '../../components/ui.jsx';
import { BillAmounts, BillStatus, PaymentList } from '../../components/bills/BillParts.jsx';

export default function BillDetailPage() {
  const { id } = useParams();
  const { t, te, lang } = useI18n();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/invoices/${id}`).then((d) => setInvoice(d.invoice)).catch((err) => setError(te(err.code)));
  }, [id, te]);

  return (
    <div className="page narrow">
      <Link to="/bills" className="back-link"><Icon name="back" size={18} /> {t('bills.myTitle')}</Link>
      <ErrorText>{error}</ErrorText>
      {!invoice && !error && <Spinner />}
      {invoice && (
        <>
          <div className="section-head">
            <div>
              <h1>{t('bills.billNumber', { number: invoice.number })}</h1>
              <p className="muted small">
                {formatDay(invoice.date, lang, { day: 'numeric', month: 'long', year: 'numeric' })}
                {invoice.branchName && ` · ${invoice.branchName}`}
              </p>
            </div>
            <BillStatus status={invoice.status} />
          </div>

          {invoice.hasFile && (
            <a className="btn primary block big" href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
              <Icon name="note" /> {t('bills.openPdf')}
            </a>
          )}

          <section className="card"><BillAmounts invoice={invoice} /></section>

          <section className="card">
            <h2>{t('bills.payments')}</h2>
            <PaymentList payments={invoice.payments} />
          </section>

          {invoice.orderId && (
            <Link className="btn block" to={`/orders/${invoice.orderId}`}>
              <Icon name="list" /> {t('orders.number', { id: invoice.orderId })}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
