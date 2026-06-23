import { useRef } from 'react';
import type { User, WorkOrder, WorkOrderPhotoKind } from '@cmc/shared';
import {
  useAddWorkOrderPhoto,
  useDeleteWorkOrderPhoto,
  useWorkOrderPhotos,
} from '../lib/queries';
import { Button, Modal } from '../components/ui';

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
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">{wo.type}</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">{wo.status}</span>
          {wo.completed_date && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
              {wo.completed_date}
            </span>
          )}
        </div>

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
