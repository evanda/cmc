import { useState } from 'react';
import { workRequestFormSchema } from '@cmc/shared';
import {
  useAcceptWorkRequest,
  useAssets,
  useCreateWorkRequest,
  useDeclineWorkRequest,
  useLocations,
  useWorkRequests,
} from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import { Button, EmptyState, Field, Modal, inputClass } from '../components/ui';

export function WorkRequestsPage() {
  const { role } = useAuth();
  const isStaff = role === 'admin' || role === 'technician';
  const requests = useWorkRequests();
  const assets = useAssets();
  const locations = useLocations();
  const accept = useAcceptWorkRequest();
  const decline = useDeclineWorkRequest();
  const [showForm, setShowForm] = useState(false);

  const assetName = (id: string | null) =>
    id ? (assets.data?.find((a) => a.id === id)?.name ?? null) : null;
  const locName = (id: string | null) =>
    id ? (locations.data?.find((l) => l.id === id)?.name ?? null) : null;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Work Requests</h1>
        <Button onClick={() => setShowForm(true)}>+ Submit request</Button>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Report a problem here; maintenance accepts it as a work order or declines it.
      </p>

      {requests.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : requests.data && requests.data.length > 0 ? (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {requests.data.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{r.title}</span>
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                    pending
                  </span>
                </div>
                {r.description && <p className="text-sm text-slate-500">{r.description}</p>}
                <p className="mt-0.5 text-xs text-slate-400">
                  {[assetName(r.linked_asset_id), locName(r.location_id)].filter(Boolean).join(' · ') ||
                    'No asset/location'}
                </p>
              </div>
              {isStaff && (
                <div className="flex shrink-0 gap-1">
                  <Button onClick={() => accept.mutate(r.id)}>Accept</Button>
                  <Button variant="ghost" onClick={() => decline.mutate(r.id)}>
                    Decline
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>No requests yet.</EmptyState>
      )}

      {showForm && (
        <RequestForm
          assets={(assets.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
          locations={(locations.data ?? []).map((l) => ({ id: l.id, name: l.name }))}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function RequestForm({
  assets,
  locations,
  onClose,
}: {
  assets: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  onClose: () => void;
}) {
  const create = useCreateWorkRequest();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assetId, setAssetId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  return (
    <Modal title="Submit a work request" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = workRequestFormSchema.safeParse({
            title,
            description,
            linked_asset_id: assetId || null,
            location_id: locationId || null,
          });
          if (!parsed.success) {
            setErrors(
              Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] as string, i.message])),
            );
            return;
          }
          setBusy(true);
          await create.mutateAsync(parsed.data);
          setBusy(false);
          onClose();
        }}
      >
        <Field label="What's the problem?" error={errors.title}>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. AC out in Room 12"
          />
        </Field>
        <Field label="Details">
          <textarea
            className={inputClass}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Asset (optional)">
            <select className={inputClass} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
              <option value="">—</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location (optional)">
            <select
              className={inputClass}
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
