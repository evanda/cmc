import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ASSET_STATUSES,
  CRITICALITIES,
  assetFormSchema,
  type Asset,
  type Building,
  type Criticality,
} from '@cmc/shared';
import {
  useAssetCategories,
  useAssets,
  useBuildings,
  useCreateAsset,
  useDeleteAsset,
  useLocations,
  useUpdateAsset,
} from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import { Button, EmptyState, Field, Modal, inputClass } from '../components/ui';
import { LocationPicker, type PlacedPoint } from '../components/LocationPicker';

const CAMPUS_DEFAULT: [number, number] = [-84.6879, 33.9441];

export function campusCenter(buildings: Building[]): [number, number] {
  for (const b of buildings) {
    const ring = b.footprint_geojson?.coordinates?.[0];
    if (ring?.length) {
      const s = ring.reduce((a: number[], p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
      return [s[0] / ring.length, s[1] / ring.length] as [number, number];
    }
  }
  return CAMPUS_DEFAULT;
}

const critStyle: Record<Criticality, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

export function AssetsPage() {
  const { role } = useAuth();
  const canEdit = role === 'admin' || role === 'technician';
  const assets = useAssets();
  const categories = useAssetCategories();
  const locations = useLocations();
  const buildings = useBuildings();
  const create = useCreateAsset();
  const update = useUpdateAsset();
  const remove = useDeleteAsset();

  const [searchParams, setSearchParams] = useSearchParams();
  const buildingParam = searchParams.get('building');
  const buildingNameParam = searchParams.get('buildingName');

  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<Asset | null>(null);
  const [showForm, setShowForm] = useState(false);

  const catName = (id: string | null) =>
    id ? (categories.data?.find((c) => c.id === id)?.name ?? '—') : '—';
  const locName = (id: string | null) =>
    id ? (locations.data?.find((l) => l.id === id)?.name ?? '—') : '—';

  // IDs of locations that belong to the selected building filter (plan §5.4).
  const buildingLocationIds = useMemo(() => {
    if (!buildingParam) return null;
    return new Set(
      (locations.data ?? [])
        .filter((l) => l.building_id === buildingParam)
        .map((l) => l.id),
    );
  }, [buildingParam, locations.data]);

  const rows = useMemo(
    () =>
      (assets.data ?? []).filter(
        (a) =>
          (!categoryFilter || a.category_id === categoryFilter) &&
          (!statusFilter || a.status === statusFilter) &&
          (!buildingLocationIds ||
            (a.location_id != null && buildingLocationIds.has(a.location_id))),
      ),
    [assets.data, categoryFilter, statusFilter, buildingLocationIds],
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Assets</h1>
          {buildingParam && (
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <span>Building: {buildingNameParam ?? buildingParam}</span>
              <button
                onClick={() => setSearchParams({}, { replace: true })}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-200"
              >
                Clear filter ×
              </button>
            </div>
          )}
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            + New asset
          </Button>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        <select
          className={inputClass + ' max-w-xs'}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={inputClass + ' max-w-[12rem]'}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {ASSET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {assets.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Location</th>
                <th className="px-4 py-2 font-medium">Criticality</th>
                <th className="px-4 py-2 font-medium">Status</th>
                {canEdit && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/assets/${a.id}`}
                      className="font-medium text-slate-800 hover:text-blue-600 hover:underline"
                    >
                      {a.name}
                    </Link>
                    {(a.make || a.model) && (
                      <div className="text-xs text-slate-400">
                        {[a.make, a.model].filter(Boolean).join(' ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{catName(a.category_id)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{locName(a.location_id)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-2 py-0.5 text-xs ${critStyle[a.criticality]}`}>
                      {a.criticality}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        a.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(a);
                          setShowForm(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => confirm(`Delete "${a.name}"?`) && remove.mutate(a.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No assets match. {canEdit && 'Create one to get started.'}</EmptyState>
      )}

      {showForm && (
        <AssetForm
          initial={editing}
          categories={(categories.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
          locations={(locations.data ?? []).map((l) => ({ id: l.id, name: l.name }))}
          center={campusCenter(buildings.data ?? [])}
          onClose={() => setShowForm(false)}
          onSubmit={async (values) => {
            if (editing) await update.mutateAsync({ id: editing.id, ...values });
            else await create.mutateAsync(values);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

export function AssetForm({
  initial,
  categories,
  locations,
  center,
  onClose,
  onSubmit,
}: {
  initial: Asset | null;
  categories: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  center: [number, number];
  onClose: () => void;
  onSubmit: (values: import('@cmc/shared').AssetForm) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '');
  const [locationId, setLocationId] = useState(initial?.location_id ?? '');
  const [criticality, setCriticality] = useState<Criticality>(initial?.criticality ?? 'low');
  const [status, setStatus] = useState(initial?.status ?? 'active');
  const [make, setMake] = useState(initial?.make ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [serial, setSerial] = useState(initial?.serial ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [contactName, setContactName] = useState(initial?.contact_name ?? '');
  const [contactEmail, setContactEmail] = useState(initial?.contact_email ?? '');
  const [mapPin, setMapPin] = useState<PlacedPoint | null>(() => {
    const g = initial?.geometry_geojson as unknown as { coordinates?: [number, number] } | null;
    if (!g?.coordinates) return null;
    return { lng: g.coordinates[0], lat: g.coordinates[1], level: initial?.level ?? 1 };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  return (
    <Modal title={initial ? 'Edit asset' : 'New asset'} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = assetFormSchema.safeParse({
            name,
            category_id: categoryId || null,
            location_id: locationId || null,
            criticality,
            status,
            make,
            model,
            serial,
            notes,
            contact_name: contactName,
            contact_email: contactEmail,
            geometry_geojson: mapPin
              ? { type: 'Point', coordinates: [mapPin.lng, mapPin.lat] }
              : null,
            map_level: mapPin?.level ?? null,
          });
          if (!parsed.success) {
            setErrors(
              Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] as string, i.message])),
            );
            return;
          }
          setBusy(true);
          await onSubmit(parsed.data);
          setBusy(false);
        }}
      >
        <Field label="Name" error={errors.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select
              className={inputClass}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <select
              className={inputClass}
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">— (unplaced)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Criticality">
            <select
              className={inputClass}
              value={criticality}
              onChange={(e) => setCriticality(e.target.value as Criticality)}
            >
              {CRITICALITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as Asset['status'])}
            >
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Make">
            <input className={inputClass} value={make} onChange={(e) => setMake(e.target.value)} />
          </Field>
          <Field label="Model">
            <input className={inputClass} value={model} onChange={(e) => setModel(e.target.value)} />
          </Field>
        </div>
        <Field label="Serial">
          <input className={inputClass} value={serial} onChange={(e) => setSerial(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact name">
            <input
              className={inputClass}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </Field>
          <Field label="Contact email" error={errors.contact_email}>
            <input
              className={inputClass}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="maintenance@…"
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            className={inputClass}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <Field label="Map location (optional)">
          <LocationPicker value={mapPin} onChange={setMapPin} center={center} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
