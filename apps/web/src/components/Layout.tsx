import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useOrgSettings } from '../lib/queries';
import { Button } from './ui';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/campus', label: 'Campus' },
  { to: '/work-orders', label: 'Work Orders' },
  { to: '/assets', label: 'Assets' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/reports', label: 'Reports' },
];

export function Layout() {
  const { role, signOut } = useAuth();
  const { data: org } = useOrgSettings();
  const items =
    role === 'admin'
      ? [...navItems, { to: '/settings', label: 'Settings' }]
      : navItems;

  const theme = org?.theme;
  const themeVars = {
    '--color-primary': theme?.primaryColor ?? '#1e293b',
    '--color-primary-fg': '#ffffff',
    '--color-accent': theme?.accentColor ?? '#0ea5e9',
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" style={themeVars}>
      {/* Thin brand-colour strip at the very top */}
      <div className="h-1 bg-[var(--color-primary)]" />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            {/* Logo + facility name (logo_url set via Settings page) */}
            <div className="flex items-center gap-2">
              {org?.logo_url && (
                <img
                  src={org.logo_url}
                  alt={org.facility_name}
                  className="h-7 w-7 rounded object-contain"
                />
              )}
              <span className="font-semibold text-slate-800">{org?.facility_name ?? 'CMC'}</span>
            </div>
            <nav className="flex gap-1">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `rounded px-3 py-1.5 text-sm ${
                      isActive
                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-fg)]'
                        : 'text-slate-600 hover:bg-slate-100'
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
