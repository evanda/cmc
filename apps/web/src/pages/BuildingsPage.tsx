import { useState } from 'react';
import { buildingFormSchema, type Building } from '@cmc/shared';
import {
  useBuildings,
  useCreateBuilding,
  useDeleteBuilding,
  useUpdateBuilding,
} from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import { Button, EmptyState, Field, Modal, inputClass } from '../components/ui';

export function BuildingsPage() {
  const { role } = useAuth();
  const canEdit = role === 'admin';
  const { data, isLoading, error } = useBuildings();
  const create = useCreateBuilding();
  const update = useUpdateBuilding();
  const remove = useDeleteBuilding();

  const [editing, setEditing] = useState<Building | null>(null);
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Buildings</h1>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            + New building
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : data && data.length > 0 ? (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {data.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium text-slate-800">{b.name}</div>
                {b.address && <div className="text-sm text-slate-500">{b.address}</div>}
                {b.description && <div className="text-sm text-slate-500">{b.description}</div>}
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditing(b);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete "${b.name}"? This also removes its floors/locations.`))
                        remove.mutate(b.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>No buildings yet. {canEdit && 'Create your first one.'}</EmptyState>
      )}

      {showForm && (
        <BuildingForm
          initial={editing}
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

function BuildingForm({
  initial,
  onClose,
  onSubmit,
}: {
  initial: Building | null;
  onClose: () => void;
  onSubmit: (values: { name: string; description?: string; address?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  return (
    <Modal title={initial ? 'Edit building' : 'New building'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = buildingFormSchema.safeParse({ name, description, address });
          if (!parsed.success) {
            setErrors(
              Object.fromEntries(
                parsed.error.issues.map((i) => [i.path[0] as string, i.message]),
              ),
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
        <Field label="Address" error={errors.address}>
          <input
            className={inputClass}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>
        <Field label="Description" error={errors.description}>
          <textarea
            className={inputClass}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
