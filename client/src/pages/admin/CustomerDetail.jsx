import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { ErrorText, Icon, Spinner, formatPhone } from '../../components/ui.jsx';
import { BranchForm, CustomerForm } from '../../components/admin/CustomerForms.jsx';
import UsersSection from '../../components/admin/UsersSection.jsx';
import LinkedBills from '../../components/bills/LinkedBills.jsx';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, te } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null); // null | 'new' | branch

  const load = useCallback(() => {
    api(`/admin/customers/${id}`).then(setData).catch((err) => setError(te(err.code)));
  }, [id, te]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="page">
        <BackLink />
        <ErrorText>{error}</ErrorText>
        {!error && <Spinner />}
      </div>
    );
  }

  const { customer, branches, users } = data;

  const deleteCustomer = async () => {
    if (!confirm(t('customers.deleteConfirm', { name: customer.name }))) return;
    try {
      await api(`/admin/customers/${customer.id}`, { method: 'DELETE' });
      navigate('/admin/customers');
    } catch (err) {
      setError(te(err.code));
    }
  };

  const deleteBranch = async (branch) => {
    if (!confirm(t('branches.deleteConfirm', { name: branch.name }))) return;
    setError('');
    try {
      await api(`/admin/branches/${branch.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(te(err.code));
    }
  };

  return (
    <div className="page">
      <BackLink />
      <div className="section-head">
        <div>
          <h1>{customer.name}</h1>
          {customer.notes && <p className="muted">{customer.notes}</p>}
        </div>
        <div className="row-actions">
          <button className="btn small" onClick={() => setEditingCustomer(true)}>
            <Icon name="edit" size={16} /> {t('common.edit')}
          </button>
          <button className="btn small danger" onClick={deleteCustomer}>
            <Icon name="trash" size={16} /> {t('common.delete')}
          </button>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>

      <section className="card">
        <div className="section-head">
          <h2>{t('branches.title')} <span className="muted">({branches.length})</span></h2>
          <button className="btn primary small" onClick={() => setEditingBranch('new')}>
            <Icon name="plus" size={18} /> {t('branches.add')}
          </button>
        </div>
        <ul className="plain-list">
          {branches.map((b) => (
            <li key={b.id} className="user-row">
              <div className="user-main">
                <strong>{b.name}</strong>
                <div className="muted small">
                  {[b.street, [b.postalCode, b.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || t('branches.noAddress')}
                </div>
                {b.phone && <div className="muted small">{formatPhone(b.phone)}</div>}
              </div>
              <div className="row-actions">
                <button className="btn small" onClick={() => setEditingBranch(b)}>
                  <Icon name="edit" size={16} /> {t('common.edit')}
                </button>
                <button className="btn small danger" onClick={() => deleteBranch(b)} aria-label={`${t('common.delete')}: ${b.name}`}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <UsersSection title={t('users.title')} users={users} mode="customer" customer={customer} branches={branches} onChanged={load} />

      <LinkedBills title={t('bills.title')} filter={{ customerId: customer.id }} prefill={{ customerId: customer.id }} />

      {editingCustomer && (
        <CustomerForm customer={customer} onClose={() => setEditingCustomer(false)}
          onSaved={() => { setEditingCustomer(false); load(); }} />
      )}
      {editingBranch && (
        <BranchForm customerId={customer.id} branch={editingBranch === 'new' ? null : editingBranch}
          onClose={() => setEditingBranch(null)} onSaved={() => { setEditingBranch(null); load(); }} />
      )}
    </div>
  );
}

function BackLink() {
  const { t } = useI18n();
  return (
    <Link to="/admin/customers" className="back-link">
      <Icon name="back" size={18} /> {t('customers.title')}
    </Link>
  );
}
