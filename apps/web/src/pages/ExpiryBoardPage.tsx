import { Link } from 'react-router-dom';
import { checkExpiries, type ExpiryItem } from '@cmc/shared';
import { useAssets, useServiceContracts, useVehicles, useVendors } from '../lib/queries';
import { EmptyState } from '../components/ui';

function ExpiryRow({ item }: { item: ExpiryItem }) {
  const { daysUntil, expiry } = item;
  const badge =
    daysUntil < 0
      ? 'bg-red-100 text-red-700'
      : daysUntil <= 7
        ? 'bg-red-100 text-red-700'
        : daysUntil <= 30
          ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-100 text-slate-500';
  const label = daysUntil < 0 ? 'Expired' : `${daysUntil}d`;

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-2">
        <Link to={item.link} className="text-slate-800 hover:underline">
          {item.name}
        </Link>
      </td>
      <td className="px-4 py-2 text-slate-500">{expiry}</td>
      <td className="px-4 py-2">
        <span className={`rounded px-2 py-0.5 text-xs ${badge}`}>{label}</span>
      </td>
    </tr>
  );
}

function Section({ title, items }: { title: string; items: ExpiryItem[] }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <EmptyState>None expiring within 60 days.</EmptyState>
      ) : (
        <table className="w-full rounded border border-slate-200 bg-white text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Expires</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ExpiryRow key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function ExpiryBoardPage() {
  const assets = useAssets();
  const vendors = useVendors();
  const contracts = useServiceContracts();
  const vehiclesQ = useVehicles();

  const isLoading = assets.isLoading || vendors.isLoading || contracts.isLoading || vehiclesQ.isLoading;

  // Build named vehicle list for expiry check (vehicles need their asset name).
  const assetMap = Object.fromEntries((assets.data ?? []).map((a) => [a.id, a.name]));
  const namedVehicles = (vehiclesQ.data ?? []).map((v) => ({
    ...v,
    name: assetMap[v.asset_id] ?? 'Vehicle',
  }));

  const report = checkExpiries({
    assets: assets.data ?? [],
    vendors: vendors.data ?? [],
    serviceContracts: contracts.data ?? [],
    vehicles: namedVehicles,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Expiry Board</h1>
          <p className="mt-1 text-sm text-slate-500">
            Warranties, COIs, vendor contracts, service agreements, and vehicle renewals expiring within 60 days.
          </p>
        </div>
        {!isLoading && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
            {report.all.length} expiring
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <>
          <Section title="Asset Warranties" items={report.warranties} />
          <Section title="Vendor COIs" items={report.vendorCois} />
          <Section title="Vendor Contracts" items={report.vendorContracts} />
          <Section title="Service Contracts" items={report.serviceContracts} />
          <Section title="Vehicle Registration" items={report.vehicleReg} />
          <Section title="Vehicle Insurance" items={report.vehicleInsurance} />
          <Section title="Vehicle Inspection" items={report.vehicleInspection} />
        </>
      )}
    </div>
  );
}
