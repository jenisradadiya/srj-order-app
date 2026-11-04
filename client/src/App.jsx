import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, homePath } from './auth.jsx';
import { useI18n } from './i18n/index.jsx';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';
import Profile from './pages/Profile.jsx';
import CustomerHome from './pages/CustomerHome.jsx';
import WarehouseHome from './pages/WarehouseHome.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Customers from './pages/admin/Customers.jsx';
import CustomerDetail from './pages/admin/CustomerDetail.jsx';
import Team from './pages/admin/Team.jsx';

export default function App() {
  const { loading, user, needsSetup, error, reload } = useAuth();
  const { t, te } = useI18n();

  if (loading) {
    return (
      <div className="splash">
        <img src="/icon.svg" alt="SRJ" className="splash-logo" />
        <Spinner />
      </div>
    );
  }
  if (error) {
    return (
      <div className="splash">
        <img src="/icon.svg" alt="SRJ" className="splash-logo" />
        <p>{te(error)}</p>
        <button className="btn primary" onClick={reload}>{t('common.retry')}</button>
      </div>
    );
  }
  if (needsSetup) return <Setup />;
  if (!user) return <Login />;

  const role = user.role;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={homePath(role)} replace />} />
        <Route path="/profile" element={<Profile />} />
        {role === 'admin' && (
          <>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/customers" element={<Customers />} />
            <Route path="/admin/customers/:id" element={<CustomerDetail />} />
            <Route path="/admin/team" element={<Team />} />
          </>
        )}
        {role === 'warehouse' && <Route path="/warehouse" element={<WarehouseHome />} />}
        {(role === 'owner' || role === 'staff') && <Route path="/home" element={<CustomerHome />} />}
        <Route path="*" element={<Navigate to={homePath(role)} replace />} />
      </Routes>
    </Layout>
  );
}
