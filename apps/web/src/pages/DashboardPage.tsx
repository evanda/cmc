import { Link } from 'react-router-dom';
import {
  ACTIVE_WORK_ORDER_STATUSES,
  checkExpiries,
  pmScheduleStatus,
  type ExpiryItem,
} from '@cmc/shared';
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

function OverdueRow({ label, tag, days, to }: { label: string; tag: string; days: number; to: string }) {
  return (
    <tr className="border-t border-slate-100 first:border-0">
      <td className="py-1.5">
        <Link to={to} className="text-slate-800 hover:underline">
          {label}
        </Link>
      </td>
      <td className="py-1.5 pr-3 text-right">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{tag}</span>
      </td>
      <td className="py-1.5 text-right">
        <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
          {days <= 0 ? 'due today' : `${days}d overdue`}
        </span>
      </td>
    </tr>
  );
}

function PmStatCard({ label, value, color }: { label: string; value: number; color: 'red' | 'amber' | 'green' }) {
  const cls = {
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-green-200 bg-green-50 text-green-700',
  }[color];
  return (
    <div className={`rounded border p-3 text-center ${cls}`}>
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
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
  const todayStr = now.toISOString().slice(0, 10);

  // ── PM schedule health (plan §4.3): overdue / due-soon / on-track, computed
  // from the first uncompleted cycle so overdue is visible (not rolled forward).
  let pmOverdue = 0;
  let pmSoon = 0;
  let pmOk = 0;
  const overduePms: { id: string; name: string; days: number }[] = [];
  for (const s of pms.data ?? []) {
    if (!s.active) continue;
    const { state, dueDate } = pmScheduleStatus(
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
      s.lead_time_days,
    );
    if (state === 'overdue') {
      pmOverdue++;
      const days = dueDate ? Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000) : 0;
      overduePms.push({ id: s.id, name: s.name, days });
    } else if (state === 'soon') {
      pmSoon++;
    } else {
      pmOk++;
    }
  }
  overduePms.sort((a, b) => b.days - a.days);

  // Overdue work orders: still-active work past its due date (plan §4.2, §4.6).
  const overdueWos = (workOrders.data ?? [])
    .filter((w) => ACTIVE_WORK_ORDER_STATUSES.includes(w.status) && !!w.due_date && w.due_date < todayStr)
    .map((w) => ({
      id: w.id,
      title: w.title,
      days: Math.floor((now.getTime() - new Date(w.due_date as string).getTime()) / 86_400_000),
    }))
    .sort((a, b) => b.days - a.days);

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
        <StatCard
          label="Maintenance due soon"
          value={pms.isLoading ? '—' : pmSoon}
          to="/reports?tab=Preventive Maintenance"
        />
        <StatCard label="Assets" value={assets.data?.length ?? '—'} to="/assets" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Buildings" value={buildings.data?.length ?? '—'} to="/campus" />
        <StatCard label="Floors" value={floors.data?.length ?? '—'} to="/campus" />
        <StatCard label="Locations" value={locations.data?.length ?? '—'} to="/campus" />
      </div>
      <div className="mb-4 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-medium text-slate-700">Preventive maintenance</span>
          <Link
            to="/reports?tab=Preventive Maintenance"
            className="text-xs text-slate-500 hover:underline"
          >
            View report →
          </Link>
        </div>
        {pms.isLoading || workOrders.isLoading ? (
          <span className="text-slate-400">Loading…</span>
        ) : (pms.data?.length ?? 0) === 0 ? (
          <span className="text-slate-500">
            No maintenance schedules yet — add one under Assets → Maintenance Schedules.
          </span>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <PmStatCard label="Overdue" value={pmOverdue} color="red" />
              <PmStatCard label="Due soon" value={pmSoon} color="amber" />
              <PmStatCard label="On track" value={pmOk} color="green" />
            </div>
            {overduePms.length + overdueWos.length > 0 ? (
              <table className="w-full">
                <tbody>
                  {overduePms.map((p) => (
                    <OverdueRow
                      key={`pm-${p.id}`}
                      label={p.name}
                      tag="Schedule"
                      days={p.days}
                      to="/reports?tab=Preventive Maintenance"
                    />
                  ))}
                  {overdueWos.map((w) => (
                    <OverdueRow
                      key={`wo-${w.id}`}
                      label={w.title}
                      tag="Work order"
                      days={w.days}
                      to="/work-orders"
                    />
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="text-slate-500">Nothing overdue.</span>
            )}
          </>
        )}
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
