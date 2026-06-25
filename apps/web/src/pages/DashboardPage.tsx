import { Link } from 'react-router-dom';
import { ACTIVE_WORK_ORDER_STATUSES, checkExpiries, upcomingDueDate } from '@cmc/shared';
import {
  useAllWorkOrders,
  useAssets,
  useBuildings,
  useFloors,
  useLocations,
  useOrgSettings,
  usePmSchedules,
  useServiceContracts,
  useVehicles,
  useVendors,
} from '../lib/queries';

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
  const workOrders = useAllWorkOrders();
  const vendors = useVendors();
  const contracts = useServiceContracts();
  const vehiclesQ = useVehicles();
  const pms = usePmSchedules();

  const now = new Date();
  const pmsDueSoon = pms.data?.filter((s) => {
    const due = upcomingDueDate(
      {
        type: s.trigger_type,
        intervalValue: s.interval_value,
        intervalUnit: s.interval_unit,
        meterThreshold: s.meter_threshold,
        fixedMonth: s.fixed_month,
        fixedDay: s.fixed_day,
      },
      new Date(s.anchor_date),
      now,
    );
    if (!due) return false;
    return Math.ceil((due.getTime() - now.getTime()) / 86_400_000) <= s.lead_time_days;
  }).length;

  const activeWorkOrders = workOrders.data?.filter((w) =>
    ACTIVE_WORK_ORDER_STATUSES.includes(w.status),
  ).length;
  const assetNameMap = Object.fromEntries((assets.data ?? []).map((a) => [a.id, a.name]));
  const namedVehicles = (vehiclesQ.data ?? []).map((v) => ({
    ...v,
    name: assetNameMap[v.asset_id] ?? 'Vehicle',
  }));
  const expiryReport = checkExpiries({
    assets: assets.data ?? [],
    vendors: vendors.data ?? [],
    serviceContracts: contracts.data ?? [],
    vehicles: namedVehicles,
  });
  const expiringSoon = expiryReport.all.length;
  const expiryLoaded = !assets.isLoading && !vendors.isLoading && !contracts.isLoading;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">
        {org?.facility_name ?? 'Campus'} — Overview
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Asset registry and campus structure. Work orders, vendors, and the map arrive in later
        Phase 1–2 work.
      </p>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Active work orders" value={activeWorkOrders ?? '—'} to="/work-orders" />
        <StatCard label="Maintenance due soon" value={pmsDueSoon ?? '—'} to="/assets" />
        <StatCard label="Assets" value={assets.data?.length ?? '—'} to="/assets" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Buildings" value={buildings.data?.length ?? '—'} to="/campus" />
        <StatCard label="Floors" value={floors.data?.length ?? '—'} to="/campus" />
        <StatCard label="Locations" value={locations.data?.length ?? '—'} to="/campus" />
      </div>
      <Link
        to="/reports?tab=Expiry"
        className="block rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm transition hover:border-slate-400"
      >
        <span className="font-medium text-slate-700">Contracts & warranties: </span>
        {!expiryLoaded ? (
          <span className="text-slate-400">Loading…</span>
        ) : expiringSoon === 0 ? (
          <span className="text-slate-500">Nothing expiring in the next 60 days</span>
        ) : (
          <span className="font-medium text-amber-700">{expiringSoon} item{expiringSoon === 1 ? '' : 's'} expiring within 60 days →</span>
        )}
      </Link>
    </div>
  );
}
