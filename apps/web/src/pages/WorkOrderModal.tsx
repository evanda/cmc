import { useRef, useState } from 'react';
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type User,
  type WorkOrder,
  type WorkOrderPhotoKind,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@cmc/shared';
import {
  useAddWorkOrderPhoto,
  useDeleteWorkOrderPhoto,
  useUpdateWorkOrder,
  useWorkOrderPhotos,
} from '../lib/queries';
import { Button, Field, Modal, inputClass } from '../components/ui';

function money(value: number | null | undefined, currency: string) {
  if (value == null) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

export function WorkOrderModal({
  wo,
  users,
  currency,
  canEdit,
  onClose,
}: {
  wo: WorkOrder;
  users: User[];
  currency: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const photos = useWorkOrderPhotos(wo.id);
  const addPhoto = useAddWorkOrderPhoto(wo.id);
  const deletePhoto = useDeleteWorkOrderPhoto(wo.id);
  const updateWo = useUpdateWorkOrder();

  const [status, setStatus] = useState<WorkOrderStatus>(wo.status);
  const [priority, setPriority] = useState<WorkOrderPriority>(wo.priority);
  const [assignee, setAssignee] = useState(wo.assignee_user_id ?? '');
  const dirty =
    status !== wo.status ||
    priority !== wo.priority ||
    (assignee || null) !== wo.assignee_user_id;

  const userName = (uid: string | null) =>
    uid ? (users.find((u) => u.id === uid)?.name ?? '—') : null;
  const costs: [string, number | null][] = [
    ['Parts', wo.actual_parts_cost],
    ['Labor', wo.actual_labor_cost],
    ['Vendor', wo.actual_vendor_cost],
  ];

  return (
    <Modal title={wo.title} onClose={onClose}>
      <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1 text-sm">
        {canEdit ? (
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-3 gap-2">
              <Field label="Status">
                <select
                  className={inputClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as WorkOrderStatus)}
                >
                  {WORK_ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <select
                  className={inputClass}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}
                >
                  {WORK_ORDER_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Assignee">
                <select
                  className={inputClass}
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.email}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                disabled={!dirty || updateWo.isPending}
                onClick={() =>
                  updateWo.mutate({
                    id: wo.id,
                    patch: { status, priority, assignee_user_id: assignee || null },
                  })
                }
              >
                {updateWo.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">{wo.type}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">{wo.status}</span>
            {wo.completed_date && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                {wo.completed_date}
              </span>
            )}
          </div>
        )}

        {wo.completion_notes && <p className="text-slate-600">{wo.completion_notes}</p>}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <Detail label="Performed by" value={wo.vendor_name ?? userName(wo.assignee_user_id)} />
          <Detail label="Coordinated by" value={userName(wo.coordinated_by_user_id)} />
          <Detail label="Authorized by" value={userName(wo.authorized_by_user_id)} />
          <Detail label="Labor hours" value={wo.labor_hours != null ? `${wo.labor_hours} h` : null} />
          {costs.map(([label, v]) => (
            <Detail key={label} label={label} value={money(v, currency)} />
          ))}
          <Detail label="Invoice #" value={wo.invoice_number} />
          <Detail label="Check / payment #" value={wo.payment_reference} />
        </dl>

        <KindGallery
          title="Before (damage)"
          kind="before"
          photos={photos.data?.filter((p) => p.kind === 'before') ?? []}
          canEdit={canEdit}
          onAdd={(file) => addPhoto.mutate({ file, kind: 'before' })}
          onDelete={(pid) => deletePhoto.mutate(pid)}
        />
        <KindGallery
          title="After (proof of repair)"
          kind="after"
          photos={photos.data?.filter((p) => p.kind === 'after') ?? []}
          canEdit={canEdit}
          onAdd={(file) => addPhoto.mutate({ file, kind: 'after' })}
          onDelete={(pid) => deletePhoto.mutate(pid)}
        />

        <div className="flex justify-end pt-1">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right text-slate-700">{value}</dd>
    </div>
  );
}

function KindGallery({
  title,
  kind,
  photos,
  canEdit,
  onAdd,
  onDelete,
}: {
  title: string;
  kind: WorkOrderPhotoKind;
  photos: { id: string; url: string; caption: string | null }[];
  canEdit: boolean;
  onAdd: (file: File) => void;
  onDelete: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              data-testid={`wo-add-${kind}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onAdd(f);
                e.target.value = '';
              }}
            />
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={() => fileRef.current?.click()}
            >
              + Add {kind}
            </button>
          </>
        )}
      </div>
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <figure key={p.id} className="group relative overflow-hidden rounded border border-slate-200">
              <img src={p.url} alt={p.caption ?? ''} className="h-24 w-full object-cover" />
              {canEdit && (
                <button
                  className="absolute right-1 top-1 rounded bg-black/50 px-1 text-xs text-white opacity-0 group-hover:opacity-100"
                  onClick={() => onDelete(p.id)}
                  title="Delete"
                >
                  ✕
                </button>
              )}
            </figure>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">None.</p>
      )}
    </section>
  );
}
