import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { ErrorText, Spinner } from '../../components/ui.jsx';
import UsersSection from '../../components/admin/UsersSection.jsx';

// SRJ's own people: admins and warehouse workers.
export default function Team() {
  const { t, te } = useI18n();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/admin/team').then((d) => setUsers(d.users)).catch((err) => setError(te(err.code)));
  }, [te]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page">
      <h1>{t('team.title')}</h1>
      <p className="muted">{t('team.intro')}</p>
      <ErrorText>{error}</ErrorText>
      {!users && !error && <Spinner />}
      {users && <UsersSection title={t('team.members')} users={users} mode="team" onChanged={load} />}
    </div>
  );
}
