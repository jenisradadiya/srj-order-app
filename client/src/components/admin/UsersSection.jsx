import { useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { ErrorText, Icon, formatPhone } from '../ui.jsx';
import UserForm from './UserForm.jsx';
import PinDialog from './PinDialog.jsx';

// List of users with add / edit / reset PIN / (de)activate / delete.
export default function UsersSection({ title, users, mode, customer, branches = [], onChanged }) {
  const { t, te, formatDate } = useI18n();
  const { user: me } = useAuth();
  const [editing, setEditing] = useState(null); // null | 'new' | user
  const [pinResult, setPinResult] = useState(null); // { user, pin }
  const [error, setError] = useState('');

  const branchName = (id) => branches.find((b) => b.id === id)?.name ?? '';

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(te(err.code));
    }
  };

  const resetPin = (u) => {
    if (!confirm(t('users.resetConfirm', { name: u.name }))) return;
    run(async () => {
      const { pin } = await api(`/admin/users/${u.id}/reset-pin`, { method: 'POST' });
      setPinResult({ user: u, pin });
    });
  };

  const toggleActive = (u) =>
    run(() => api(`/admin/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } }));

  const remove = (u) => {
    if (!confirm(t('users.deleteConfirm', { name: u.name }))) return;
    run(() => api(`/admin/users/${u.id}`, { method: 'DELETE' }));
  };

  const saved = (user, pin) => {
    setEditing(null);
    if (pin) setPinResult({ user, pin });
    onChanged();
  };

  return (
    <section className="card">
      <div className="section-head">
        <h2>{title} <span className="muted">({users.length})</span></h2>
        <button className="btn primary small" onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} /> {t('users.add')}
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
      {users.length === 0 && <p className="muted">{t('users.empty')}</p>}

      <ul className="plain-list">
        {users.map((u) => {
          const isMe = u.id === me.id;
          return (
            <li key={u.id} className={`user-row ${u.active ? '' : 'inactive'}`}>
              <div className="user-main">
                <div className="user-title">
                  <strong>{u.name}</strong>
                  {isMe && <span className="muted small">{t('users.you')}</span>}
                  <span className={`badge role-${u.role}`}>{t(`roles.${u.role}`)}</span>
                  {!u.active && <span className="badge">{t('users.inactive')}</span>}
                </div>
                <div className="muted small">
                  {formatPhone(u.phone)}
                  {u.role === 'owner' && ` · ${t('users.allBranches')}`}
                  {u.role === 'staff' && ` · ${branchName(u.branchId)}`}
                </div>
                <div className="muted small">
                  {u.lastLoginAt ? t('users.lastLogin', { date: formatDate(u.lastLoginAt) }) : t('users.neverLoggedIn')}
                </div>
              </div>
              <div className="row-actions">
                <button className="btn small" onClick={() => setEditing(u)}>
                  <Icon name="edit" size={16} /> {t('common.edit')}
                </button>
                {!isMe && (
                  <>
                    <button className="btn small" onClick={() => resetPin(u)}>
                      <Icon name="key" size={16} /> {t('users.resetPin')}
                    </button>
                    <button className="btn small" onClick={() => toggleActive(u)}>
                      {u.active ? t('users.deactivate') : t('users.activate')}
                    </button>
                    <button className="btn small danger" onClick={() => remove(u)} aria-label={`${t('common.delete')}: ${u.name}`}>
                      <Icon name="trash" size={16} />
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {editing && (
        <UserForm mode={mode} customer={customer} branches={branches} user={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)} onSaved={saved} />
      )}
      {pinResult && <PinDialog user={pinResult.user} pin={pinResult.pin} onClose={() => setPinResult(null)} />}
    </section>
  );
}
