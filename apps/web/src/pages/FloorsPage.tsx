import { useState } from 'react';
import { floorFormSchema, type Floor } from '@cmc/shared';
import { useBuildings, useCreateFloor, useDeleteFloor, useFloors, useUpdateFloor } from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import { Button, EmptyState, Field, Modal, inputClass } from '../components/ui';

export function FloorsPage() {
  const { role } = useAuth();
  const canEdit = role === 'admin';
  const buildings = useBuildings();
  const [buildingFilter, setBuildingFilter] = useState<string>('');
  const { data, isLoading } = useFloors(buildingFilter || undefined);
  const create = useCreateFloor();
  const update = useUpdateFloor();
  const remove = useDeleteFloor();

  const [editing, setEditing] = useState<Floor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const buildingName = (id: string) => buildings.data?.find((b) => b.id === id)?.name ?? '—';
  const hasBuildings = (buildings.data?.length ?? 0) > 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Floors</h1>
        {canEdit && (
          <Button
            disabled={!hasBuildings}
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            + New floor
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
        <EmptyState>Add a building first — floors belong to a building.</EmptyState>
      ) : isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : data && data.length > 0 ? (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {data.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium text-slate-800">
                  {f.name} <span className="text-slate-400">· level {f.level}</span>
                </div>
                <div className="text-sm text-slate-500">{buildingName(f.building_id)}</div>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditing(f);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => confirm(`Delete "${f.name}"?`) && remove.mutate(f.id)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>No floors yet.</EmptyState>
      )}

      {showForm && (
        <FloorForm
          initial={editing}
          buildings={(buildings.data ?? []).map((b) => ({ id: b.id, name: b.name }))}
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

function FloorForm({
  initial,
  buildings,
  defaultBuildingId,
  onClose,
  onSubmit,
}: {
  initial: Floor | null;
  buildings: { id: string; name: string }[];
  defaultBuildingId: string;
  onClose: () => void;
  onSubmit: (values: { building_id: string; name: string; level: number }) => Promise<void>;
}) {
  const [buildingId, setBuildingId] = useState(
    initial?.building_id ?? defaultBuildingId ?? buildings[0]?.id ?? '',
  );
  const [name, setName] = useState(initial?.name ?? '');
  const [level, setLevel] = useState(String(initial?.level ?? 1));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  return (
    <Modal title={initial ? 'Edit floor' : 'New floor'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = floorFormSchema.safeParse({ building_id: buildingId, name, level });
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
            onChange={(e) => setBuildingId(e.target.value)}
          >
            <option value="">Select…</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name" error={errors.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Level (-1 = B1, 0/1 = ground, 2…)" error={errors.level}>
          <input
            type="number"
            className={inputClass}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
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
