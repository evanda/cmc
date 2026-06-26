import React, { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ACTIVE_WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
  pmScheduleStatus,
  workLogFormSchema,
  type Criticality,
  type PmSchedule,
  type User,
  type WorkOrder,
  type WorkOrderPhotoKind,
} from '@cmc/shared';
import { ds } from '../lib/datasource';
import { WorkOrderModal } from './WorkOrderModal';
import { QrLabelModal } from './QrLabelModal';
import { AssetForm, campusCenter } from './AssetsPage';
import { PmForm } from './PmSchedulesPage';
import {
  useAddAssetPhoto,
  useAsset,
  useAssetCategories,
  useAssetPhotos,
  useAssets,
  useBuildings,
  useCreateWorkOrder,
  useDeleteAssetPhoto,
  useLocations,
  useOrgSettings,
  usePmSchedules,
  usePois,
  useSetPrimaryPhoto,
  useUpdateAsset,
  useUsers,
  useVehicles,
  useVendors,
  useWorkOrders,
} from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import { Button, EmptyState, ExpiryBadge, Field, Modal, inputClass } from '../components/ui';

const critStyle: Record<Criticality, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

function money(value: number | null | undefined, currency: string) {
  if (value == null) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function woTotal(wo: WorkOrder): number | null {
  const parts = [wo.actual_parts_cost, wo.actual_labor_cost, wo.actual_vendor_cost];
  if (parts.every((p) => p == null)) return null;
  return parts.reduce<number>((sum, p) => sum + (p ?? 0), 0);
}

export function AssetDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const canEdit = role === 'admin' || role === 'technician';
  const canFileWo = role === 'admin' || role === 'technician' || role === 'requester';
  const { data: org } = useOrgSettings();
  const currency = org?.currency ?? 'USD';

  const asset = useAsset(id);
  const assetList = useAssets();
  const categories = useAssetCategories();
  const locations = useLocations();
  const buildings = useBuildings();
  const { data: allPois } = usePois();
  const linkedPoi = allPois?.find((p) => p.linked_asset_id === id);
  const users = useUsers();
  const photos = useAssetPhotos(id);
  const workOrders = useWorkOrders(id);
  const pms = usePmSchedules();
  const vehicles = useVehicles();
  const updateAsset = useUpdateAsset();

  const addPhoto = useAddAssetPhoto(id);
  const setPrimary = useSetPrimaryPhoto(id);
  const deletePhoto = useDeleteAssetPhoto(id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showLog, setShowLog] = useState(false);
  const [viewWo, setViewWo] = useState<WorkOrder | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [editPm, setEditPm] = useState<PmSchedule | null>(null);

  const userName = (uid: string | null) =>
    uid ? (users.data?.find((u) => u.id === uid)?.name ?? '—') : null;
  const catName = asset.data?.category_id
    ? categories.data?.find((c) => c.id === asset.data?.category_id)?.name
    : null;
  const locName = asset.data?.location_id
    ? locations.data?.find((l) => l.id === asset.data?.location_id)?.name
    : null;

  if (asset.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!asset.data) return <EmptyState>Asset not found.</EmptyState>;
  const a = asset.data;

  // Split work into what's still open vs. the completed/closed history log.
  const allWos = workOrders.data ?? [];
  const openWos = allWos.filter((w) => ACTIVE_WORK_ORDER_STATUSES.includes(w.status));
  const historyWos = allWos.filter((w) => !ACTIVE_WORK_ORDER_STATUSES.includes(w.status));
  const assetPms = (pms.data ?? []).filter((s) => s.asset_id === id && s.active);
  const vehicle = vehicles.data?.find((v) => v.asset_id === id);
  const profilePhoto = photos.data?.find((p) => p.is_primary) ?? photos.data?.[0];
  const todayStr = new Date().toISOString().slice(0, 10);

  const contactEmail = a.contact_email ?? org?.maintenance_contact_email ?? null;
  const contactName = a.contact_name ?? (a.contact_email ? null : 'Maintenance team');

  return (
    <div className="space-y-6">
      <div>
        <Link to="/assets" className="text-sm text-slate-500 hover:text-slate-700">
          ← Assets
        </Link>
        <div className="mt-1 flex items-center gap-3">
          {profilePhoto && (
            <button
              onClick={() => setShowPhotos(true)}
              className="shrink-0"
              title="View photos"
            >
              <img
                src={profilePhoto.url}
                alt=""
                className="h-12 w-12 rounded-md border border-slate-200 object-cover"
              />
            </button>
          )}
          <h1 className="text-2xl font-semibold text-slate-800">{a.name}</h1>
          <span className={`rounded px-2 py-0.5 text-xs ${critStyle[a.criticality]}`}>
            {a.criticality}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {a.status}
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => setShowPhotos(true)}>
              Photos{photos.data?.length ? ` (${photos.data.length})` : ''}
            </Button>
            {canEdit && (
              <Button variant="ghost" onClick={() => setShowEdit(true)}>
                Edit
              </Button>
            )}
            {canEdit && (
              <Button variant="ghost" onClick={() => setShowQr(true)}>
                QR label
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Specs + contact */}
        <div className="space-y-4 lg:col-span-1">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Details
            </h2>
            <dl className="space-y-1.5 text-sm">
              <Row label="Category" value={catName ?? '—'} />
              <Row label="Location" value={locName ?? 'Unplaced'} />
              <Row label="Make / Model" value={[a.make, a.model].filter(Boolean).join(' ') || '—'} />
              <Row label="Serial" value={a.serial ?? '—'} />
              {(linkedPoi || a.geometry_geojson) && (
                <Row
                  label="Map location"
                  value={
                    <Link
                      to={`/map?asset=${id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {linkedPoi
                        ? `${linkedPoi.label}${linkedPoi.level != null ? ` · level ${linkedPoi.level}` : ''}`
                        : `${a.geometry_geojson!.coordinates[1].toFixed(5)}, ${a.geometry_geojson!.coordinates[0].toFixed(5)}${a.level != null ? ` · level ${a.level}` : ''}`}
                      {' — View on map →'}
                    </Link>
                  }
                />
              )}
            </dl>
            {a.notes && <p className="mt-3 text-sm text-slate-600">{a.notes}</p>}
          </section>

          {vehicle && (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Vehicle
              </h2>
              <dl className="space-y-1.5 text-sm">
                <Row
                  label="Year / Make / Model"
                  value={[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'}
                />
                <Row label="VIN" value={vehicle.vin ?? '—'} />
                <Row label="Plate" value={vehicle.plate ?? '—'} />
                {vehicle.fuel_type && <Row label="Fuel" value={vehicle.fuel_type} />}
                {vehicle.capacity != null && <Row label="Capacity" value={String(vehicle.capacity)} />}
                <Row label="Registration" value={<ExpiryBadge date={vehicle.registration_expiry} />} />
                <Row label="Insurance" value={<ExpiryBadge date={vehicle.insurance_expiry} />} />
                <Row label="Inspection" value={<ExpiryBadge date={vehicle.inspection_expiry} />} />
              </dl>
              {canEdit && (
                <Link
                  to="/assets?tab=Fleet"
                  className="mt-3 inline-block text-xs text-blue-600 hover:underline"
                >
                  Edit vehicle details in Fleet →
                </Link>
              )}
            </section>
          )}

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Point of contact
            </h2>
            {contactEmail ? (
              <div className="text-sm">
                {contactName && <div className="font-medium text-slate-800">{contactName}</div>}
                <a className="text-blue-600 hover:underline" href={`mailto:${contactEmail}`}>
                  {contactEmail}
                </a>
                {!a.contact_email && (
                  <div className="mt-1 text-xs text-slate-400">Org maintenance contact (default)</div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No contact set.</p>
            )}
          </section>
        </div>

        {/* Open work + maintenance — the operational info, kept beside Details */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Open work orders
              </h2>
              {canFileWo && (
                <Button variant="ghost" onClick={() => navigate(`/work-orders?asset=${id}`)}>
                  + New
                </Button>
              )}
            </div>
            {openWos.length > 0 ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {openWos.map((w) => {
                  const overdue = !!w.due_date && w.due_date < todayStr;
                  return (
                    <li key={w.id}>
                      <button
                        onClick={() => setViewWo(w)}
                        className="flex w-full items-center justify-between gap-2 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="font-medium text-slate-800">{w.title}</span>
                          <span className="ml-2 text-xs text-slate-400">{w.type}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {w.due_date && (
                            <span
                              className={`rounded px-2 py-0.5 text-xs ${
                                overdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              due {w.due_date}
                            </span>
                          )}
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                            {w.status}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No open work orders.</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Maintenance schedules
            </h2>
            {assetPms.length > 0 ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {assetPms.map((s) => {
                  const row = (
                    <>
                      <span className="font-medium text-slate-800">{s.name}</span>
                      <PmDueBadge schedule={s} />
                    </>
                  );
                  return (
                    <li key={s.id}>
                      {canEdit ? (
                        <button
                          onClick={() => setEditPm(s)}
                          className="flex w-full items-center justify-between gap-2 py-2 text-left hover:bg-slate-50"
                        >
                          {row}
                        </button>
                      ) : (
                        <div className="flex items-center justify-between gap-2 py-2">{row}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No maintenance schedules for this asset.</p>
            )}
          </div>
        </div>
      </div>

      {/* Work history */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Work history</h2>
          <div className="flex gap-2">
            {canEdit && <Button onClick={() => setShowLog(true)}>+ Log work</Button>}
          </div>
        </div>
        {historyWos.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium w-6"></th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Work</th>
                  <th className="px-3 py-2 font-medium">By / coordinated / authorized</th>
                  <th className="px-3 py-2 font-medium">Cost</th>
                  <th className="px-3 py-2 font-medium">Invoice / payment</th>
                  <th className="px-3 py-2 font-medium">Photos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Completed / closed / cancelled work — open items live above. */}
                {historyWos.map((w) => {
                  const done = w.status === 'completed' || w.status === 'closed';
                  return (
                  <tr
                    key={w.id}
                    className={`cursor-pointer align-top ${done ? 'bg-slate-50 hover:bg-slate-100' : 'hover:bg-slate-50'}`}
                    onClick={() => setViewWo(w)}
                    title="Open work order (before/after photos)"
                  >
                    <td className="px-3 py-2.5">
                      {done ? (
                        <span title="Completed" className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">✓</span>
                      ) : (
                        <span title={w.status} className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-500 text-xs">●</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                      {w.completed_date ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-800">{w.title}</div>
                      <div className="text-xs text-slate-400">{w.type}</div>
                      {w.completion_notes && (
                        <div className="mt-0.5 text-xs text-slate-500">{w.completion_notes}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      <div>{w.vendor_name ?? userName(w.assignee_user_id) ?? '—'}</div>
                      {userName(w.coordinated_by_user_id) && (
                        <div className="text-slate-400">
                          coord: {userName(w.coordinated_by_user_id)}
                        </div>
                      )}
                      {userName(w.authorized_by_user_id) && (
                        <div className="text-slate-400">
                          auth: {userName(w.authorized_by_user_id)}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                      {money(woTotal(w), currency) ?? '—'}
                      {w.labor_hours != null && (
                        <div className="text-xs text-slate-400">{w.labor_hours} h</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {w.invoice_number && <div>inv {w.invoice_number}</div>}
                      {w.payment_reference && <div className="text-slate-400">{w.payment_reference}</div>}
                      {!w.invoice_number && !w.payment_reference && '—'}
                    </td>
                    <td className="px-3 py-2.5 text-blue-600">📷 view</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No completed work yet. {canEdit && 'Log the first entry.'}</EmptyState>
        )}
      </section>

      {showLog && (
        <LogWorkModal
          users={users.data ?? []}
          onClose={() => setShowLog(false)}
          assetId={id}
        />
      )}
      {viewWo && (
        <WorkOrderModal
          wo={viewWo}
          users={users.data ?? []}
          currency={currency}
          canEdit={canEdit}
          onClose={() => setViewWo(null)}
        />
      )}
      {showQr && <QrLabelModal asset={a} onClose={() => setShowQr(false)} />}
      {showEdit && (
        <AssetForm
          initial={a}
          categories={(categories.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
          locations={(locations.data ?? []).map((l) => ({ id: l.id, name: l.name }))}
          center={campusCenter(buildings.data ?? [])}
          onClose={() => setShowEdit(false)}
          onSubmit={async (values) => {
            await updateAsset.mutateAsync({ id, ...values });
            setShowEdit(false);
          }}
        />
      )}
      {editPm && (
        <PmForm
          assets={(assetList.data ?? []).map((x) => ({ id: x.id, name: x.name }))}
          initial={editPm}
          onClose={() => setEditPm(null)}
        />
      )}
      {showPhotos && (
        <Modal title="Photos" onClose={() => setShowPhotos(false)}>
          {canEdit && (
            <div className="mb-3 flex justify-end">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) addPhoto.mutate(f);
                  e.target.value = '';
                }}
              />
              <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                + Add photo
              </Button>
            </div>
          )}
          {photos.data && photos.data.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.data.map((p) => (
                <figure key={p.id} className="overflow-hidden rounded border border-slate-200">
                  <img src={p.url} alt={p.caption ?? ''} className="h-32 w-full object-cover" />
                  <figcaption className="flex items-center justify-between px-2 py-1 text-xs">
                    <span className="flex items-center gap-1 text-slate-500">
                      {p.is_primary && (
                        <span className="rounded bg-blue-100 px-1 text-[10px] text-blue-700">
                          primary
                        </span>
                      )}
                      <span className="truncate">{p.caption}</span>
                    </span>
                    {canEdit && (
                      <span className="flex gap-1">
                        {!p.is_primary && (
                          <button
                            className="text-slate-400 hover:text-blue-600"
                            onClick={() => setPrimary.mutate(p.id)}
                            title="Set as primary"
                          >
                            ★
                          </button>
                        )}
                        <button
                          className="text-slate-400 hover:text-red-600"
                          onClick={() => deletePhoto.mutate(p.id)}
                          title="Delete"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No photos yet.{canEdit && ' Use “+ Add photo” above.'}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

function PmDueBadge({ schedule: s }: { schedule: PmSchedule }) {
  const { state, dueDate } = pmScheduleStatus(
    {
      type: s.trigger_type,
      intervalValue: s.interval_value,
      intervalUnit: s.interval_unit,
      meterThreshold: s.meter_threshold,
      fixedMonth: s.fixed_month,
      fixedDay: s.fixed_day,
    },
    new Date(s.anchor_date),
    new Date(),
    s.lead_time_days,
  );
  if (!dueDate) {
    return <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">meter-based</span>;
  }
  const cls =
    state === 'overdue'
      ? 'bg-red-100 text-red-700'
      : state === 'soon'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-500';
  const label = state === 'overdue' ? 'overdue' : 'due';
  return (
    <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${cls}`}>
      {label} {dueDate.toISOString().slice(0, 10)}
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right text-slate-700">{value}</dd>
    </div>
  );
}

function LogWorkModal({
  users,
  assetId,
  onClose,
}: {
  users: User[];
  assetId: string;
  onClose: () => void;
}) {
  const create = useCreateWorkOrder(assetId);
  const vendors = useVendors();
  const [f, setF] = useState({
    title: '',
    type: 'reactive',
    completed_date: '',
    vendor_id: '',
    vendor_name: '',
    assignee_user_id: '',
    coordinated_by_user_id: '',
    authorized_by_user_id: '',
    actual_parts_cost: '',
    actual_labor_cost: '',
    actual_vendor_cost: '',
    labor_hours: '',
    invoice_number: '',
    payment_reference: '',
    completion_notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ file: File; kind: WorkOrderPhotoKind; url: string }[]>([]);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  const addPending = (file: File, kind: WorkOrderPhotoKind) =>
    setPending((p) => [...p, { file, kind, url: URL.createObjectURL(file) }]);

  const userOpts = (label: string) => (
    <>
      <option value="">{label}</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name ?? u.email}
        </option>
      ))}
    </>
  );

  return (
    <Modal title="Log work" onClose={onClose}>
      <form
        className="max-h-[70vh] space-y-3 overflow-y-auto pr-1"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = workLogFormSchema.safeParse({
            ...f,
            vendor_id: f.vendor_id || null,
            assignee_user_id: f.assignee_user_id || null,
            coordinated_by_user_id: f.coordinated_by_user_id || null,
            authorized_by_user_id: f.authorized_by_user_id || null,
          });
          if (!parsed.success) {
            setErrors(
              Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] as string, i.message])),
            );
            return;
          }
          setBusy(true);
          const wo = await create.mutateAsync(parsed.data);
          // Upload any before/after photos against the newly created work order.
          for (const p of pending) await ds.addWorkOrderPhoto(wo.id, p.file, p.kind);
          setBusy(false);
          onClose();
        }}
      >
        <Field label="What was done" error={errors.title}>
          <input className={inputClass} value={f.title} onChange={set('title')} />
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
          <Field label="Date completed">
            <input type="date" className={inputClass} value={f.completed_date} onChange={set('completed_date')} />
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
          <Field label="Or other performer">
            <input className={inputClass} value={f.vendor_name} onChange={set('vendor_name')} />
          </Field>
          <Field label="Internal assignee">
            <select className={inputClass} value={f.assignee_user_id} onChange={set('assignee_user_id')}>
              {userOpts('—')}
            </select>
          </Field>
          <Field label="Coordinated by">
            <select
              className={inputClass}
              value={f.coordinated_by_user_id}
              onChange={set('coordinated_by_user_id')}
            >
              {userOpts('—')}
            </select>
          </Field>
          <Field label="Authorized by">
            <select
              className={inputClass}
              value={f.authorized_by_user_id}
              onChange={set('authorized_by_user_id')}
            >
              {userOpts('—')}
            </select>
          </Field>
          <Field label="Parts cost" error={errors.actual_parts_cost}>
            <input className={inputClass} value={f.actual_parts_cost} onChange={set('actual_parts_cost')} />
          </Field>
          <Field label="Labor cost" error={errors.actual_labor_cost}>
            <input className={inputClass} value={f.actual_labor_cost} onChange={set('actual_labor_cost')} />
          </Field>
          <Field label="Vendor cost" error={errors.actual_vendor_cost}>
            <input className={inputClass} value={f.actual_vendor_cost} onChange={set('actual_vendor_cost')} />
          </Field>
          <Field label="Labor hours" error={errors.labor_hours}>
            <input className={inputClass} value={f.labor_hours} onChange={set('labor_hours')} />
          </Field>
          <Field label="Invoice #">
            <input className={inputClass} value={f.invoice_number} onChange={set('invoice_number')} />
          </Field>
          <Field label="Check / payment #">
            <input className={inputClass} value={f.payment_reference} onChange={set('payment_reference')} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={inputClass} rows={2} value={f.completion_notes} onChange={set('completion_notes')} />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">Photos</span>
            <input
              ref={beforeRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) addPending(file, 'before');
                e.target.value = '';
              }}
            />
            <input
              ref={afterRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) addPending(file, 'after');
                e.target.value = '';
              }}
            />
            <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => beforeRef.current?.click()}>
              + Before (damage)
            </button>
            <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => afterRef.current?.click()}>
              + After (repair)
            </button>
          </div>
          {pending.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {pending.map((p, i) => (
                <figure key={i} className="relative overflow-hidden rounded border border-slate-200">
                  <img src={p.url} alt="" className="h-16 w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded bg-black/50 px-1 text-[10px] text-white">
                    {p.kind}
                  </span>
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded bg-black/50 px-1 text-[10px] text-white"
                    onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </figure>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save entry'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
