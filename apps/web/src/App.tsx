import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { useOrgSettings } from './lib/queries';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { SetupWizardPage } from './pages/SetupWizardPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { DashboardPage } from './pages/DashboardPage';
import { AssetsTabPage } from './pages/AssetsTabPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { AssetByTokenPage } from './pages/AssetByTokenPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { CampusPage } from './pages/CampusPage';
import { VendorsPage } from './pages/VendorsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsTabPage } from './pages/SettingsTabPage';

// Ensures org_settings exists before rendering the main app layout.
// If the DB row is missing (fresh deployment), redirects to /setup.
function OrgGuard() {
  const { data: org, isLoading } = useOrgSettings();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }
  if (!org) {
    return <Navigate to="/setup" replace />;
  }
  return <Outlet />;
}

export function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <Routes>
      {/* /accept-invite is accessible before the invite session is established */}
      <Route path="accept-invite" element={<AcceptInvitePage />} />

      {!session ? (
        <Route path="*" element={<LoginPage />} />
      ) : (
        <>
          {/* /setup is reachable before org_settings exists */}
          <Route path="setup" element={<SetupWizardPage />} />

          {/* OrgGuard redirects to /setup if org_settings is null (fresh instance) */}
          <Route element={<OrgGuard />}>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="campus" element={<CampusPage />} />
              <Route path="map" element={<Navigate to="/campus" replace />} />
              <Route path="requests" element={<Navigate to="/work-orders" replace />} />
              <Route path="work-orders" element={<WorkOrdersPage />} />
              <Route path="assets" element={<AssetsTabPage />} />
              <Route path="assets/:id" element={<AssetDetailPage />} />
              <Route path="a/:token" element={<AssetByTokenPage />} />
              <Route path="pm" element={<Navigate to="/assets" replace />} />
              <Route path="fleet" element={<Navigate to="/assets" replace />} />
              <Route path="vendors" element={<VendorsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsTabPage />} />
              <Route path="users" element={<Navigate to="/settings" replace />} />
              <Route path="buildings" element={<Navigate to="/campus" replace />} />
              <Route path="floors" element={<Navigate to="/campus" replace />} />
              <Route path="locations" element={<Navigate to="/campus" replace />} />
              <Route path="expiry" element={<Navigate to="/reports" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </>
      )}
    </Routes>
  );
}
