import { useState } from 'react';
import { locationFormSchema, type Building, type Location } from '@cmc/shared';
import {
  useBuildings,
  useCreateLocation,
  useDeleteLocation,
  useFloors,
  useLocations,
  useUpdateLocation,
} from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import { Button, EmptyState, Field, Modal, inputClass } from '../components/ui';
import { LocationPicker, type PlacedPoint } from '../components/LocationPicker';

const CAMPUS_DEFAULT: [number, number] = [-80.428, 36.09];

function campusCenter(buildings: Building[]): [number, number] {
  for (const b of buildings) {
    const ring = b.footprint_geojson?.coordinates?.[0];
    if (ring?.length) {
      const s = ring.reduce((a: number[], p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
      return [s[0] / ring.length, s[1] / ring.length] as [number, number];
    }
  }
  return CAMPUS_DEFAULT;
}

export function LocationsPage() {
  const { role } = useAuth();
  const canEdit = role === 'admin';
  const buildings = useBuildings();
  const [buildingFilter, setBuildingFilter] = useState('');
  const { data, isLoading } = useLocations(buildingFilter || undefined);
  const create = useCreateLocation();
  const update = useUpdateLocation();
  const remove = useDeleteLocation();

  const [editing, setEditing] = useState<Location | null>(null);
  const [showForm, setShowForm] = useState(false);
  const buildingName = (id: string) => buildings.data?.find((b) => b.id === id)?.name ?? '—';
  const hasBuildings = (buildings.data?.length ?? 0) > 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Locations</h1>
        {canEdit && (
          <Button
            disabled={!hasBuildings}
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            + New location
          </Button>
        )}
      </div>

      <div className="mb-4">
        <select
          className={inputClass + ' max-w-xs'}
          value={buildingFilter}
          onChange={(e) => setBuildingFilter(e.target.value)}
        >
          <option value="">All buildings</option>
          {buildings.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {!hasBuildings ? (
        <EmptyState>Add a building first — locations belong to a building.</EmptyState>
      ) : isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : data && data.length > 0 ? (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {data.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium text-slate-800">
                  {l.name} {l.type && <span className="text-slate-400">· {l.type}</span>}
                </div>
                <div className="text-sm text-slate-500">{buildingName(l.building_id)}</div>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditing(l);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => confirm(`Delete "${l.name}"?`) && remove.mutate(l.id)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>No locations yet.</EmptyState>
      )}

      {showForm && (
        <LocationForm
          initial={editing}
          buildings={buildings.data ?? []}
          defaultBuildingId={buildingFilter}
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

function LocationForm({
  initial,
  buildings,
  defaultBuildingId,
  onClose,
  onSubmit,
}: {
  initial: Location | null;
  buildings: Building[];
  defaultBuildingId: string;
  onClose: () => void;
  onSubmit: (values: import('@cmc/shared').LocationForm) => Promise<void>;
}) {
  const [buildingId, setBuildingId] = useState(
    initial?.building_id ?? defaultBuildingId ?? buildings[0]?.id ?? '',
  );
  const [floorId, setFloorId] = useState(initial?.floor_id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? '');
  const [mapPin, setMapPin] = useState<PlacedPoint | null>(() => {
    const g = initial?.geometry_geojson as unknown as { coordinates?: [number, number] } | null;
    if (!g?.coordinates) return null;
    return { lng: g.coordinates[0], lat: g.coordinates[1], level: initial?.level ?? 1 };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const floors = useFloors(buildingId || undefined);

  return (
    <Modal title={initial ? 'Edit location' : 'New location'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = locationFormSchema.safeParse({
            building_id: buildingId,
            floor_id: floorId || null,
            name,
            type,
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
        <Field label="Building" error={errors.building_id}>
          <select
            className={inputClass}
            value={buildingId}
            onChange={(e) => {
              setBuildingId(e.target.value);
              setFloorId('');
            }}
          >
            <option value="">Select…</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Floor (optional)">
          <select
            className={inputClass}
            value={floorId}
            onChange={(e) => setFloorId(e.target.value)}
            disabled={!buildingId}
          >
            <option value="">— none —</option>
            {floors.data?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} (level {f.level})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name" error={errors.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Type (room, area, …)" error={errors.type}>
          <input className={inputClass} value={type} onChange={(e) => setType(e.target.value)} />
        </Field>
        <Field label="Map location (optional)">
          <LocationPicker
            value={mapPin}
            onChange={setMapPin}
            center={campusCenter(buildings)}
          />
        </Field>
        <div className="flex justify-end gap-2">
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
