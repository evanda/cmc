import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExpiryBoardPage } from './ExpiryBoardPage';
import {
  capitalForecast,
  capitalForecastTotal,
  pmScheduleStatus,
  type WorkOrder,
} from '@cmc/shared';
import {
  useAllWorkOrders,
  useAssetCategories,
  useAssets,
  useBuildings,
  useLocations,
  useOrgSettings,
  usePmSchedules,
} from '../lib/queries';

const YEAR = new Date().getFullYear();
const TODAY = new Date();

function woActual(w: WorkOrder): number {
  return (w.actual_parts_cost ?? 0) + (w.actual_labor_cost ?? 0) + (w.actual_vendor_cost ?? 0);
}

function Bar({ value, max, label, amount }: { value: number; max: number; label: string; amount: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-40 shrink-0 truncate text-slate-600">{label}</div>
      <div className="h-5 flex-1 rounded bg-slate-100">
        <div className="h-5 rounded bg-slate-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-24 shrink-0 text-right text-slate-700">{amount}</div>
    </div>
  );
}

const TABS = ['Spend & Forecast', 'Preventive Maintenance', 'Expiry'] as const;
type Tab = (typeof TABS)[number];

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
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
  );
}

export function ReportsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = TABS.includes(searchParams.get('tab') as Tab)
    ? (searchParams.get('tab') as Tab)
    : 'Spend & Forecast';
  const [tab, setTab] = useState<Tab>(initialTab);
  const { data: org } = useOrgSettings();
  const currency = org?.currency ?? 'USD';
  const fmt = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }),
    [currency],
  );
  const money = (n: number) => fmt.format(n);

  const assets = useAssets();
  const categories = useAssetCategories();
  const locations = useLocations();
  const buildings = useBuildings();
  const workOrders = useAllWorkOrders();
  const pms = usePmSchedules();

  // ── Capital-replacement forecast (plan §9) ─────────────────────────────────
  const forecast = useMemo(
    () => capitalForecast(assets.data ?? [], YEAR, 15),
    [assets.data],
  );
  const forecastTotal = capitalForecastTotal(forecast);
  const forecastMax = Math.max(1, ...forecast.map((r) => r.total));

  // ── Spend (completed work orders) by category / building ───────────────────
  const { byCategory, byBuilding, totalSpend, estimateVsActual } = useMemo(() => {
    const assetById = new Map((assets.data ?? []).map((a) => [a.id, a]));
    const catById = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
    const locById = new Map((locations.data ?? []).map((l) => [l.id, l]));
    const bldById = new Map((buildings.data ?? []).map((b) => [b.id, b.name]));
    const cat = new Map<string, number>();
    const bld = new Map<string, number>();
    let total = 0;
    let est = 0;
    for (const w of workOrders.data ?? []) {
      const amt = woActual(w);
      if (amt <= 0) continue;
      total += amt;
      est += w.estimate_cost ?? 0;
      const asset = w.linked_asset_id ? assetById.get(w.linked_asset_id) : undefined;
      const catName = asset?.category_id ? (catById.get(asset.category_id) ?? 'Uncategorized') : 'Uncategorized';
      cat.set(catName, (cat.get(catName) ?? 0) + amt);
      const loc = asset?.location_id ? locById.get(asset.location_id) : undefined;
      const bldName = loc ? (bldById.get(loc.building_id) ?? 'Unassigned') : 'Unassigned';
      bld.set(bldName, (bld.get(bldName) ?? 0) + amt);
    }
    const sort = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    return {
      byCategory: sort(cat),
      byBuilding: sort(bld),
      totalSpend: total,
      estimateVsActual: { estimate: est, actual: total },
    };
  }, [workOrders.data, assets.data, categories.data, locations.data, buildings.data]);

  // ── PM status (engine-computed) ────────────────────────────────────────────
  const pmStatus = useMemo(() => {
    let overdue = 0;
    let soon = 0;
    let ok = 0;
    for (const s of pms.data ?? []) {
      if (!s.active) continue;
      const { state } = pmScheduleStatus(
        {
          type: s.trigger_type,
          intervalValue: s.interval_value,
          intervalUnit: s.interval_unit,
          meterThreshold: s.meter_threshold,
          fixedMonth: s.fixed_month,
          fixedDay: s.fixed_day,
        },
        new Date(s.anchor_date),
        TODAY,
        s.lead_time_days,
      );
      if (state === 'overdue') overdue++;
      else if (state === 'soon') soon++;
      else ok++;
    }
    return { overdue, soon, ok };
  }, [pms.data]);

  const spendMax = Math.max(1, ...byCategory.map(([, v]) => v), ...byBuilding.map(([, v]) => v));

  return (
    <div className="space-y-8">
      <TabBar tab={tab} setTab={setTab} />

      {tab === 'Expiry' && <ExpiryBoardPage />}

      {tab === 'Spend & Forecast' && (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Capital-replacement forecast</h2>
              <span className="text-sm text-slate-500">
                {YEAR}–{YEAR + 14} · projected {money(forecastTotal)}
              </span>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              Major assets by projected replacement year (install date + expected life). Overdue
              items fold into {YEAR}.
            </p>
            {forecastTotal > 0 ? (
              <div className="space-y-1.5">
                {forecast
                  .filter((r) => r.total > 0)
                  .map((r) => (
                    <Bar
                      key={r.year}
                      label={`${r.year} · ${r.count} asset${r.count === 1 ? '' : 's'}`}
                      value={r.total}
                      max={forecastMax}
                      amount={money(r.total)}
                    />
                  ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                No assets have install date + expected life + replacement cost yet.
              </p>
            )}
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-1 text-lg font-semibold text-slate-800">Spend by category</h2>
              <p className="mb-4 text-sm text-slate-500">
                Completed work-order cost · total {money(totalSpend)}
              </p>
              {byCategory.length > 0 ? (
                <div className="space-y-1.5">
                  {byCategory.map(([name, amt]) => (
                    <Bar key={name} label={name} value={amt} max={spendMax} amount={money(amt)} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No completed work-order costs yet.</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-1 text-lg font-semibold text-slate-800">Spend by building</h2>
              <p className="mb-4 text-sm text-slate-500">
                Estimate {money(estimateVsActual.estimate)} → actual{' '}
                {money(estimateVsActual.actual)}
              </p>
              {byBuilding.length > 0 ? (
                <div className="space-y-1.5">
                  {byBuilding.map(([name, amt]) => (
                    <Bar key={name} label={name} value={amt} max={spendMax} amount={money(amt)} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No completed work-order costs yet.</p>
              )}
            </div>
          </section>
        </>
      )}

      {tab === 'Preventive Maintenance' && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-lg font-semibold text-slate-800">Preventive maintenance</h2>
          <p className="mb-4 text-sm text-slate-500">
            Schedule health from the engine. (True on-time compliance % needs the daily job&apos;s
            completion history — issue #18.)
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded border border-red-200 bg-red-50 p-4 text-center">
              <div className="text-2xl font-semibold text-red-700">{pmStatus.overdue}</div>
              <div className="text-xs text-red-600">Overdue</div>
            </div>
            <div className="rounded border border-amber-200 bg-amber-50 p-4 text-center">
              <div className="text-2xl font-semibold text-amber-700">{pmStatus.soon}</div>
              <div className="text-xs text-amber-600">Due soon</div>
            </div>
            <div className="rounded border border-green-200 bg-green-50 p-4 text-center">
              <div className="text-2xl font-semibold text-green-700">{pmStatus.ok}</div>
              <div className="text-xs text-green-600">On track</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
