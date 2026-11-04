import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, homePath } from './auth.jsx';
import { useI18n } from './i18n/index.jsx';
import { DraftProvider } from './lib/draft.jsx';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';
import Profile from './pages/Profile.jsx';
import DayView from './pages/team/DayView.jsx';
import TeamOrders from './pages/team/TeamOrders.jsx';
import TeamOrderDetail from './pages/team/TeamOrderDetail.jsx';
import Stock from './pages/team/Stock.jsx';
import Routes_ from './pages/admin/Routes.jsx';
import PlanEditor from './pages/admin/PlanEditor.jsx';
import OrderPage from './pages/customer/OrderPage.jsx';
import CartPage from './pages/customer/CartPage.jsx';
import OrdersPage from './pages/customer/OrdersPage.jsx';
import OrderDetailPage from './pages/customer/OrderDetailPage.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Customers from './pages/admin/Customers.jsx';
import CustomerDetail from './pages/admin/CustomerDetail.jsx';
import Team from './pages/admin/Team.jsx';
import Orders from './pages/admin/Orders.jsx';
import OrderDetail from './pages/admin/OrderDetail.jsx';
import Products from './pages/admin/Products.jsx';
import ProductImport from './pages/admin/ProductImport.jsx';

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
  const isCustomer = role === 'owner' || role === 'staff';

  const routes = (
    <Routes>
      <Route path="/" element={<Navigate to={homePath(role)} replace />} />
      <Route path="/profile" element={<Profile />} />
      {role === 'admin' && (
        <>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/orders" element={<Orders />} />
          <Route path="/admin/orders/:id" element={<OrderDetail />} />
          <Route path="/admin/customers" element={<Customers />} />
          <Route path="/admin/customers/:id" element={<CustomerDetail />} />
          <Route path="/admin/products" element={<Products />} />
          <Route path="/admin/products/import" element={<ProductImport />} />
          <Route path="/admin/team" element={<Team />} />
          <Route path="/admin/routes" element={<Routes_ />} />
          <Route path="/admin/routes/plan/:key" element={<PlanEditor />} />
          <Route path="/admin/day" element={<DayView />} />
          <Route path="/admin/stock" element={<Stock />} />
        </>
      )}
      {role === 'warehouse' && (
        <>
          <Route path="/warehouse" element={<DayView />} />
          <Route path="/warehouse/orders" element={<TeamOrders />} />
          <Route path="/warehouse/orders/:id" element={<TeamOrderDetail />} />
          <Route path="/warehouse/stock" element={<Stock />} />
        </>
      )}
      {isCustomer && (
        <>
          <Route path="/order" element={<OrderPage />} />
          <Route path="/order/cart" element={<CartPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </>
      )}
      <Route path="*" element={<Navigate to={homePath(role)} replace />} />
    </Routes>
  );

  return (
    <Layout>
      {isCustomer ? <DraftProvider key={user.id}>{routes}</DraftProvider> : routes}
    </Layout>
  );
}
