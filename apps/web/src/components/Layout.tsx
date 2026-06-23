import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useOrgSettings } from '../lib/queries';
import { Button } from './ui';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/requests', label: 'Requests' },
  { to: '/work-orders', label: 'Work Orders' },
  { to: '/assets', label: 'Assets' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/buildings', label: 'Buildings' },
  { to: '/floors', label: 'Floors' },
  { to: '/locations', label: 'Locations' },
];

export function Layout() {
  const { role, signOut } = useAuth();
  const { data: org } = useOrgSettings();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">{org?.facility_name ?? 'CMC'}</span>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `rounded px-3 py-1.5 text-sm ${
                      isActive ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            {role && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{role}</span>}
            <Button variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
