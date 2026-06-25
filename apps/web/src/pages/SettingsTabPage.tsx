import { useState } from 'react';
import { SettingsPage } from './SettingsPage';
import { UsersPage } from './UsersPage';
import { useAuth } from '../auth/AuthProvider';

const TABS = ['Settings', 'Users'] as const;
type Tab = (typeof TABS)[number];

export function SettingsTabPage() {
  const { role } = useAuth();
  const [tab, setTab] = useState<Tab>('Settings');

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t
                ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Settings' && <SettingsPage />}
      {tab === 'Users' && role === 'admin' && <UsersPage />}
    </div>
  );
}
