import { Link } from 'react-router-dom';
import { ACTIVE_WORK_ORDER_STATUSES, upcomingDueDate } from '@cmc/shared';
import {
  useAllWorkOrders,
  useAssets,
  useBuildings,
  useFloors,
  useLocations,
  useOrgSettings,
  usePmSchedules,
  useServiceContracts,
  useVendors,
  useWorkRequests,
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
  const requests = useWorkRequests();
  const vendors = useVendors();
  const contracts = useServiceContracts();
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

  const openRequests = requests.data?.length;
  const activeWorkOrders = workOrders.data?.filter((w) =>
    ACTIVE_WORK_ORDER_STATUSES.includes(w.status),
  ).length;
  const within30 = (d: string | null) =>
    d != null && Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000) <= 30;
  const expiringSoon =
    (vendors.data?.filter((v) => within30(v.coi_expiry) || within30(v.contract_expiry)).length ?? 0) +
    (contracts.data?.filter((c) => within30(c.end_date)).length ?? 0);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">
        {org?.facility_name ?? 'Campus'} — Overview
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Asset registry and campus structure. Work orders, vendors, and the map arrive in later
        Phase 1–2 work.
      </p>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Open requests" value={openRequests ?? '—'} to="/requests" />
        <StatCard label="Active work orders" value={activeWorkOrders ?? '—'} to="/work-orders" />
        <StatCard label="PMs due soon" value={pmsDueSoon ?? '—'} to="/pm" />
        <StatCard label="Expiring soon (COI/contract)" value={expiringSoon} to="/vendors" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Assets" value={assets.data?.length ?? '—'} to="/assets" />
        <StatCard label="Buildings" value={buildings.data?.length ?? '—'} to="/buildings" />
        <StatCard label="Floors" value={floors.data?.length ?? '—'} to="/floors" />
        <StatCard label="Locations" value={locations.data?.length ?? '—'} to="/locations" />
      </div>
    </div>
  );
}
