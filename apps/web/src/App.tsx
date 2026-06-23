import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AssetsPage } from './pages/AssetsPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { AssetByTokenPage } from './pages/AssetByTokenPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { WorkRequestsPage } from './pages/WorkRequestsPage';
import { VendorsPage } from './pages/VendorsPage';
import { MapPage } from './pages/MapPage';
import { UsersPage } from './pages/UsersPage';
import { PmSchedulesPage } from './pages/PmSchedulesPage';
import { ReportsPage } from './pages/ReportsPage';
import { BuildingsPage } from './pages/BuildingsPage';
import { FloorsPage } from './pages/FloorsPage';
import { LocationsPage } from './pages/LocationsPage';

export function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="requests" element={<WorkRequestsPage />} />
        <Route path="work-orders" element={<WorkOrdersPage />} />
        <Route path="pm" element={<PmSchedulesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="assets/:id" element={<AssetDetailPage />} />
        <Route path="a/:token" element={<AssetByTokenPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="buildings" element={<BuildingsPage />} />
        <Route path="floors" element={<FloorsPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
