import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AssetsPage } from './AssetsPage';
import { PmSchedulesPage } from './PmSchedulesPage';
import { FleetPage } from './FleetPage';

const TABS = ['Assets', 'Maintenance Schedules', 'Fleet'] as const;
type Tab = (typeof TABS)[number];

export function AssetsTabPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = TABS.includes(searchParams.get('tab') as Tab)
    ? (searchParams.get('tab') as Tab)
    : 'Assets';
  const [tab, setTab] = useState<Tab>(initialTab);
  const selectTab = (t: Tab) => {
    setTab(t);
    const next = new URLSearchParams(searchParams);
    if (t === 'Assets') next.delete('tab');
    else next.set('tab', t);
    setSearchParams(next, { replace: true });
  };

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => selectTab(t)}
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
