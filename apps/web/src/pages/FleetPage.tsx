import { useState } from 'react';
import { Link } from 'react-router-dom';
import { vehicleFormSchema, type Vehicle } from '@cmc/shared';
import { useAssets, useVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle } from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import { Button, EmptyState, Field, Modal, inputClass } from '../components/ui';

// ── Helpers ──────────────────────────────────────────────────────────────────

function expiryClass(dateStr: string | null): string {
  if (!dateStr) return 'text-slate-400';
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'text-red-600 font-medium';
  if (days <= 30) return 'text-amber-600 font-medium';
  if (days <= 60) return 'text-yellow-600';
  return 'text-slate-700';
}

function ExpiryCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-slate-400">—</span>;
  const cls = expiryClass(date);
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
  const label = days < 0 ? `${date} (expired)` : date;
  return <span className={cls}>{label}</span>;
}

// ── Vehicle form modal ────────────────────────────────────────────────────────

type VehicleModalProps = {
  vehicle: Vehicle | null;
  assetOptions: { id: string; name: string }[];
  onClose: () => void;
};

function VehicleModal({ vehicle, assetOptions, onClose }: VehicleModalProps) {
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();

  const [form, setForm] = useState({
    asset_id: vehicle?.asset_id ?? '',
    vin: vehicle?.vin ?? '',
    plate: vehicle?.plate ?? '',
    year: vehicle?.year != null ? String(vehicle.year) : '',
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    fuel_type: vehicle?.fuel_type ?? '',
    capacity: vehicle?.capacity != null ? String(vehicle.capacity) : '',
    registration_expiry: vehicle?.registration_expiry ?? '',
    insurance_expiry: vehicle?.insurance_expiry ?? '',
    inspection_expiry: vehicle?.inspection_expiry ?? '',
    driver_contact_id: vehicle?.driver_contact_id ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  function set(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = vehicleFormSchema.safeParse({
      ...form,
      year: form.year === '' ? undefined : form.year,
      capacity: form.capacity === '' ? undefined : form.capacity,
      driver_contact_id: form.driver_contact_id === '' ? undefined : form.driver_contact_id,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      if (vehicle) {
        await updateVehicle.mutateAsync({ id: vehicle.id, input: parsed.data });
      } else {
        await createVehicle.mutateAsync(parsed.data);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  const isPending = createVehicle.isPending || updateVehicle.isPending;

  return (
    <Modal title={vehicle ? 'Edit vehicle' : 'Add vehicle'} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <Field label="Asset (bus/vehicle) *">
          <select
            className={inputClass}
            value={form.asset_id}
            onChange={(e) => set('asset_id', e.target.value)}
          >
            <option value="">— pick an asset —</option>
            {assetOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Year">
            <input
              type="number"
              className={inputClass}
              placeholder="2019"
              value={form.year}
              onChange={(e) => set('year', e.target.value)}
            />
          </Field>
          <Field label="Fuel type">
            <input
              className={inputClass}
              placeholder="Diesel"
              value={form.fuel_type}
              onChange={(e) => set('fuel_type', e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Make">
            <input
              className={inputClass}
              placeholder="Blue Bird"
              value={form.make}
              onChange={(e) => set('make', e.target.value)}
            />
          </Field>
          <Field label="Model">
            <input
              className={inputClass}
              placeholder="All American RE"
              value={form.model}
              onChange={(e) => set('model', e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="VIN">
            <input
              className={inputClass}
              placeholder="1BAFJ5BJ…"
              value={form.vin}
              onChange={(e) => set('vin', e.target.value)}
            />
          </Field>
          <Field label="Plate">
            <input
              className={inputClass}
              placeholder="SCH-441"
              value={form.plate}
              onChange={(e) => set('plate', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Capacity (seats)">
          <input
            type="number"
            className={inputClass}
            placeholder="52"
            value={form.capacity}
            onChange={(e) => set('capacity', e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Reg. expiry">
            <input
              type="date"
              className={inputClass}
              value={form.registration_expiry}
              onChange={(e) => set('registration_expiry', e.target.value)}
            />
          </Field>
          <Field label="Insurance expiry">
            <input
              type="date"
              className={inputClass}
              value={form.insurance_expiry}
              onChange={(e) => set('insurance_expiry', e.target.value)}
            />
          </Field>
          <Field label="Inspection expiry">
            <input
              type="date"
              className={inputClass}
              value={form.inspection_expiry}
              onChange={(e) => set('inspection_expiry', e.target.value)}
            />
          </Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : vehicle ? 'Save changes' : 'Add vehicle'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function FleetPage() {
  const { role } = useAuth();
  const canEdit = role === 'admin' || role === 'technician';

  const { data: vehicles = [], isLoading: vLoading } = useVehicles();
  const { data: assets = [], isLoading: aLoading } = useAssets();
  const deleteVehicle = useDeleteVehicle();

  const [modal, setModal] = useState<'add' | Vehicle | null>(null);

  const isLoading = vLoading || aLoading;

  // Index assets for lookup by id.
  const assetMap = Object.fromEntries(assets.map((a) => [a.id, a]));

  // Assets available for linking: unlinked ones plus the currently-edited vehicle's asset.
  const linkedAssetIds = new Set(vehicles.map((v) => v.asset_id));
  const editingAssetId = modal instanceof Object && 'asset_id' in modal ? modal.asset_id : null;
  const linkableAssets = assets.filter(
    (a) => !linkedAssetIds.has(a.id) || a.id === editingAssetId,
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Fleet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Bus registration, insurance, and inspection renewal dates.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setModal('add')}>+ Add vehicle</Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : vehicles.length === 0 ? (
        <EmptyState>
          No vehicles yet.{' '}
          {canEdit && (
            <button
              className="underline"
              onClick={() => setModal('add')}
            >
              Add the first one.
            </button>
          )}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full rounded border border-slate-200 bg-white text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Vehicle / Asset</th>
                <th className="px-4 py-2 font-medium">Year · Make · Model</th>
                <th className="px-4 py-2 font-medium">VIN</th>
                <th className="px-4 py-2 font-medium">Plate</th>
                <th className="px-4 py-2 font-medium">Registration</th>
                <th className="px-4 py-2 font-medium">Insurance</th>
                <th className="px-4 py-2 font-medium">Inspection</th>
                {canEdit && <th className="px-4 py-2 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => {
                const asset = assetMap[v.asset_id];
                return (
                  <tr key={v.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium">
                      {asset ? (
                        <Link to={`/assets/${asset.id}`} className="hover:underline text-slate-800">
                          {asset.name}
                        </Link>
                      ) : (
                        <span className="text-slate-400 italic">Unknown asset</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {[v.year, v.make, v.model].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">
                      {v.vin ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {v.plate ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <ExpiryCell date={v.registration_expiry} />
                    </td>
                    <td className="px-4 py-2">
                      <ExpiryCell date={v.insurance_expiry} />
                    </td>
                    <td className="px-4 py-2">
                      <ExpiryCell date={v.inspection_expiry} />
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => setModal(v)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Remove ${asset?.name ?? 'this vehicle'}?`)) {
                                void deleteVehicle.mutateAsync(v.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal != null && (
        <VehicleModal
          vehicle={modal === 'add' ? null : modal}
          assetOptions={linkableAssets}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
