import { useState } from 'react';
import { AssetsPage } from './AssetsPage';
import { PmSchedulesPage } from './PmSchedulesPage';
import { FleetPage } from './FleetPage';

const TABS = ['Assets', 'Maintenance Schedules', 'Fleet'] as const;
type Tab = (typeof TABS)[number];

export function AssetsTabPage() {
  const [tab, setTab] = useState<Tab>('Assets');

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
      {tab === 'Assets' && <AssetsPage />}
      {tab === 'Maintenance Schedules' && <PmSchedulesPage />}
      {tab === 'Fleet' && <FleetPage />}
    </div>
  );
}
