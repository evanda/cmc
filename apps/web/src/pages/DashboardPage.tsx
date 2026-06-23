import { Link } from 'react-router-dom';
import { useAssets, useBuildings, useFloors, useLocations, useOrgSettings } from '../lib/queries';

function StatCard({ label, value, to }: { label: string; value: number | string; to: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-slate-200 bg-white p-5 transition hover:border-slate-400"
    >
      <div className="text-3xl font-semibold text-slate-800">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </Link>
  );
}

export function DashboardPage() {
  const { data: org } = useOrgSettings();
  const assets = useAssets();
  const buildings = useBuildings();
  const floors = useFloors();
  const locations = useLocations();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">
        {org?.facility_name ?? 'Campus'} — Overview
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Asset registry and campus structure. Work orders, vendors, and the map arrive in later
        Phase 1–2 work.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Assets" value={assets.data?.length ?? '—'} to="/assets" />
        <StatCard label="Buildings" value={buildings.data?.length ?? '—'} to="/buildings" />
        <StatCard label="Floors" value={floors.data?.length ?? '—'} to="/floors" />
        <StatCard label="Locations" value={locations.data?.length ?? '—'} to="/locations" />
      </div>
    </div>
  );
}
