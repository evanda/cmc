import { useState } from 'react';
import { MapPage } from './MapPage';
import { BuildingsPage } from './BuildingsPage';
import { FloorsPage } from './FloorsPage';
import { LocationsPage } from './LocationsPage';

const TABS = ['Map', 'Buildings', 'Floors', 'Locations'] as const;
type Tab = (typeof TABS)[number];

export function CampusPage() {
  const [tab, setTab] = useState<Tab>('Map');

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
      {tab === 'Map' && <MapPage />}
      {tab === 'Buildings' && <BuildingsPage />}
      {tab === 'Floors' && <FloorsPage />}
      {tab === 'Locations' && <LocationsPage />}
    </div>
  );
}
