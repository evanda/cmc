import { useState } from 'react';
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_TYPES,
  workOrderFormSchema,
  type WorkOrder,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@cmc/shared';
import {
  useAllWorkOrders,
  useAssets,
  useCreateWorkOrderFromForm,
  useLocations,
  useOrgSettings,
  useUsers,
  useVendors,
} from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import { Button, Field, Modal, inputClass } from '../components/ui';
import { WorkOrderModal } from './WorkOrderModal';
import { WorkOrderCalendar, WorkOrderList } from './WorkOrderViews';

type View = 'board' | 'list' | 'calendar';

const priorityStyle: Record<WorkOrderPriority, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

// Board columns; each gathers one or more underlying statuses.
const columns: { label: string; statuses: WorkOrderStatus[] }[] = [
  { label: 'Open', statuses: ['requested', 'open'] },
  { label: 'In progress', statuses: ['in_progress'] },
  { label: 'On hold', statuses: ['on_hold'] },
  { label: 'Completed', statuses: ['completed', 'closed'] },
];

export function WorkOrdersPage() {
  const { role } = useAuth();
  const canEdit = role === 'admin' || role === 'technician';
  const { data: org } = useOrgSettings();
  const currency = org?.currency ?? 'USD';
  const workOrders = useAllWorkOrders();
  const assets = useAssets();
  const users = useUsers();
  const [open, setOpen] = useState<WorkOrder | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [view, setView] = useState<View>('board');

  const assetName = (id: string | null) =>
    id ? (assets.data?.find((a) => a.id === id)?.name ?? null) : null;
  const userName = (id: string | null) =>
    id ? (users.data?.find((u) => u.id === id)?.name ?? null) : null;
  const items = workOrders.data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Work Orders</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-300 p-0.5 text-sm">
            {(['board', 'list', 'calendar'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded px-2.5 py-1 capitalize ${
                  view === v ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {canEdit && <Button onClick={() => setShowNew(true)}>+ New work order</Button>}
        </div>
      </div>

      {workOrders.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : view === 'list' ? (
        <WorkOrderList workOrders={items} assetName={assetName} userName={userName} onOpen={setOpen} />
      ) : view === 'calendar' ? (
        <WorkOrderCalendar
          workOrders={items}
          assetName={assetName}
          userName={userName}
          onOpen={setOpen}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((col) => {
            const items = (workOrders.data ?? []).filter((w) => col.statuses.includes(w.status));
            return (
              <div key={col.label} className="rounded-lg bg-slate-100/70 p-2">
                <div className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-slate-600">
                  <span>{col.label}</span>
                  <span className="rounded-full bg-white px-2 text-xs text-slate-500">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => setOpen(w)}
                      className="block w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-400"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-slate-800">{w.title}</span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${priorityStyle[w.priority]}`}
                        >
                          {w.priority}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {assetName(w.linked_asset_id) ?? 'No asset'}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                        <span>{userName(w.assignee_user_id) ?? 'Unassigned'}</span>
                        {w.due_date && <span>due {w.due_date}</span>}
                      </div>
                    </button>
                  ))}
                  {items.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-slate-400">None</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <WorkOrderModal
          wo={open}
          users={users.data ?? []}
          currency={currency}
          canEdit={canEdit}
          onClose={() => setOpen(null)}
        />
      )}
      {showNew && (
        <NewWorkOrderModal
          assets={(assets.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
          users={users.data ?? []}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function NewWorkOrderModal({
  assets,
  users,
  onClose,
}: {
  assets: { id: string; name: string }[];
  users: { id: string; name: string | null; email: string }[];
  onClose: () => void;
}) {
  const create = useCreateWorkOrderFromForm();
  const locations = useLocations();
  const vendors = useVendors();
  const [f, setF] = useState({
    title: '',
    description: '',
    type: 'reactive',
    priority: 'medium',
    linked_asset_id: '',
    location_id: '',
    assignee_user_id: '',
    vendor_id: '',
    due_date: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <Modal title="New work order" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = workOrderFormSchema.safeParse({
            ...f,
            status: 'open',
            linked_asset_id: f.linked_asset_id || null,
            location_id: f.location_id || null,
            assignee_user_id: f.assignee_user_id || null,
            vendor_id: f.vendor_id || null,
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
        <Field label="Title" error={errors.title}>
          <input className={inputClass} value={f.title} onChange={set('title')} />
        </Field>
        <Field label="Description">
          <textarea className={inputClass} rows={2} value={f.description} onChange={set('description')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className={inputClass} value={f.type} onChange={set('type')}>
              {WORK_ORDER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className={inputClass} value={f.priority} onChange={set('priority')}>
              {WORK_ORDER_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Asset">
            <select className={inputClass} value={f.linked_asset_id} onChange={set('linked_asset_id')}>
              <option value="">—</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <select className={inputClass} value={f.location_id} onChange={set('location_id')}>
              <option value="">—</option>
              {locations.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assignee">
            <select className={inputClass} value={f.assignee_user_id} onChange={set('assignee_user_id')}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vendor">
            <select className={inputClass} value={f.vendor_id} onChange={set('vendor_id')}>
              <option value="">—</option>
              {vendors.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input type="date" className={inputClass} value={f.due_date} onChange={set('due_date')} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
