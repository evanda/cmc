import { Link } from 'react-router-dom';
import { ACTIVE_WORK_ORDER_STATUSES, checkExpiries, upcomingDueDate, type ExpiryItem } from '@cmc/shared';
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

function ExpiryRow({ item }: { item: ExpiryItem }) {
  const { daysUntil } = item;
  const badge =
    daysUntil < 0
      ? 'bg-red-100 text-red-700'
      : daysUntil <= 7
        ? 'bg-red-100 text-red-700'
        : daysUntil <= 30
          ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-100 text-slate-500';
  const badgeLabel = daysUntil < 0 ? 'Expired' : `${daysUntil}d`;
  return (
    <tr className="border-t border-slate-100 first:border-0">
      <td className="py-1.5">
        <Link to={item.link} className="text-slate-800 hover:underline">
          {item.name}
        </Link>
      </td>
      <td className="py-1.5 pr-3 text-right text-slate-500">{item.expiry}</td>
      <td className="py-1.5 text-right">
        <span className={`rounded px-2 py-0.5 text-xs ${badge}`}>{badgeLabel}</span>
      </td>
    </tr>
  );
}

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
        Asset registry, work orders, preventive maintenance, vendors, and campus map.
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
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-medium text-slate-700">Contracts &amp; warranties</span>
          {expiringSoon > 0 && (
            <Link
              to="/reports?tab=Expiry"
              className="text-xs text-slate-500 hover:underline"
            >
              View all on Expiry Board →
            </Link>
          )}
        </div>
        {!expiryLoaded ? (
          <span className="text-slate-400">Loading…</span>
        ) : expiringSoon === 0 ? (
          <span className="text-slate-500">Nothing expiring in the next 60 days</span>
        ) : (
          <table className="w-full">
            <tbody>
              {expiryReport.all.map((item) => (
                <ExpiryRow key={`${item.kind}-${item.id}`} item={item} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
