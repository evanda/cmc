import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  ACTIVE_WORK_ORDER_STATUSES,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_TYPES,
  workOrderFormSchema,
  type WorkOrder,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@cmc/shared';
import {
  useAddPhotosToWorkOrder,
  useAllWorkOrders,
  useAssets,
  useCreateWorkOrderFromForm,
  useLocations,
  useOrgSettings,
  usePmSchedules,
  useUpdateWorkOrder,
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

// Column-aware keyboard coordinate getter for @dnd-kit KeyboardSensor.
// ArrowLeft/Right jumps the drag overlay directly to the adjacent column center
// so keyboard users move card→column instead of nudging by pixels.
// ArrowUp/Down returns undefined (no-op; cards are not sortable within a column).
// Exported for unit testing.
export const columnKeyboardCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates, context: { droppableContainers } },
) => {
  if (event.code !== KeyboardCode.Right && event.code !== KeyboardCode.Left) return;
  event.preventDefault();

  const colRects = columns.flatMap((col) => {
    const rect = droppableContainers.get(col.label)?.rect?.current;
    return rect ? [{ label: col.label, rect }] : [];
  });
  if (colRects.length === 0) return;

  let currentIdx = colRects.findIndex(
    ({ rect }) => currentCoordinates.x >= rect.left && currentCoordinates.x <= rect.right,
  );
  if (currentIdx === -1) currentIdx = 0;

  const targetIdx =
    event.code === KeyboardCode.Right
      ? Math.min(currentIdx + 1, colRects.length - 1)
      : Math.max(currentIdx - 1, 0);

  if (targetIdx === currentIdx) return;

  const { rect } = colRects[targetIdx];
  return { x: rect.left + rect.width / 2, y: currentCoordinates.y };
};

// Board columns; each gathers one or more underlying statuses.
export const columns: { label: string; statuses: WorkOrderStatus[] }[] = [
  { label: 'Open', statuses: ['requested', 'open'] },
  { label: 'In progress', statuses: ['in_progress'] },
  { label: 'On hold', statuses: ['on_hold'] },
  { label: 'Completed', statuses: ['completed', 'closed'] },
];

// Canonical drop-target status per column label (what dragging INTO that column sets).
export const columnDropStatus: Record<string, WorkOrderStatus> = {
  Open: 'open',
  'In progress': 'in_progress',
  'On hold': 'on_hold',
  Completed: 'completed',
};

/**
 * Pure helper: applies the building filter to a list of work orders.
 * Returns the original list when `buildingLocationIds` is null (no filter).
 * Exported for unit testing without rendering.
 */
export function filterByBuilding(
  workOrders: WorkOrder[],
  buildingLocationIds: Set<string> | null,
): WorkOrder[] {
  if (!buildingLocationIds) return workOrders;
  return workOrders.filter(
    (w) => w.location_id != null && buildingLocationIds.has(w.location_id),
  );
}

/**
 * Pure helper: whether a work order is overdue (active status + due date passed).
 * `today` is the caller's ISO date string (YYYY-MM-DD), injectable for tests.
 */
export function isOverdue(wo: WorkOrder, today: string): boolean {
  return (
    ACTIVE_WORK_ORDER_STATUSES.includes(wo.status) && !!wo.due_date && wo.due_date < today
  );
}

/**
 * Pure helper: resolves the status a card should move TO when dropped on
 * `columnLabel`. Returns `null` when the card is already in that column
 * (no-op). Used in handleDragEnd and directly testable without rendering.
 */
export function resolveDropStatus(
  columnLabel: string,
  currentStatus: WorkOrderStatus,
): WorkOrderStatus | null {
  const target = columnDropStatus[columnLabel] as WorkOrderStatus | undefined;
  if (!target) return null; // unknown column
  const col = columns.find((c) => c.label === columnLabel);
  if (!col) return null;
  // If the card already belongs to this column, dropping is a no-op.
  if (col.statuses.includes(currentStatus)) return null;
  return target;
}

// ── Draggable card ────────────────────────────────────────────────────────────
function DraggableCard({
  wo,
  canDrag,
  assetName,
  userName,
  onClick,
}: {
  wo: WorkOrder;
  canDrag: boolean;
  assetName: (id: string | null) => string | null;
  userName: (id: string | null) => string | null;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: wo.id,
    data: { workOrder: wo },
    disabled: !canDrag,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;
  const overdue = isOverdue(wo, new Date().toISOString().slice(0, 10));

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      {...attributes}
      {...listeners}
      className={`block w-full rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-slate-400 ${
        overdue ? 'border-l-4 border-l-red-400 border-slate-200' : 'border-slate-200'
      } ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''} ${
        isDragging ? 'opacity-40 ring-2 ring-blue-300' : ''
      }`}
    >
      <CardContent wo={wo} assetName={assetName} userName={userName} />
    </button>
  );
}

// ── Card content (shared between DraggableCard and DragOverlay) ───────────────
function CardContent({
  wo,
  assetName,
  userName,
}: {
  wo: WorkOrder;
  assetName: (id: string | null) => string | null;
  userName: (id: string | null) => string | null;
}) {
  const overdue = isOverdue(wo, new Date().toISOString().slice(0, 10));
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-slate-800">{wo.title}</span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${priorityStyle[wo.priority]}`}>
          {wo.priority}
        </span>
      </div>
      <div className="mt-1 text-xs text-slate-500">{assetName(wo.linked_asset_id) ?? 'No asset'}</div>
      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
        <span>{userName(wo.assignee_user_id) ?? 'Unassigned'}</span>
        {wo.due_date && (
          <span
            className={
              overdue
                ? 'rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700'
                : undefined
            }
          >
            {overdue ? 'overdue ' : 'due '}
            {wo.due_date}
          </span>
        )}
      </div>
    </>
  );
}

// ── Droppable column ──────────────────────────────────────────────────────────
function DroppableColumn({
  col,
  children,
  count,
}: {
  col: (typeof columns)[number];
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.label });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg p-2 transition-colors ${
        isOver ? 'bg-blue-100/80 ring-2 ring-blue-300' : 'bg-slate-100/70'
      }`}
    >
      <div className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-slate-600">
        <span>{col.label}</span>
        <span className="rounded-full bg-white px-2 text-xs text-slate-500">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function WorkOrdersPage() {
  const { role } = useAuth();
  const canEdit = role === 'admin' || role === 'technician';
  const { data: org } = useOrgSettings();
  const currency = org?.currency ?? 'USD';
  const workOrders = useAllWorkOrders();
  const assets = useAssets();
  const users = useUsers();
  const locations = useLocations();
  const pmSchedules = usePmSchedules();
  const [open, setOpen] = useState<WorkOrder | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [view, setView] = useState<View>('board');

  // Deep link from the map: /work-orders?asset=<id> opens the New WO modal
  // pre-linked to that asset (plan §5.4, #37). Only staff can create WOs.
  const [searchParams, setSearchParams] = useSearchParams();
  const assetParam = searchParams.get('asset');
  // Building filter: /work-orders?building=<id> from the map building card (plan §5.4, #5).
  const buildingParam = searchParams.get('building');
  const buildingNameParam = searchParams.get('buildingName');
  // Schedule filter: /work-orders?source_pm=<id> from a PM schedule's "N work orders" link.
  const sourcePmParam = searchParams.get('source_pm');
  const sourcePmName = sourcePmParam
    ? (pmSchedules.data?.find((s) => s.id === sourcePmParam)?.name ?? sourcePmParam)
    : null;
  useEffect(() => {
    if (assetParam && canEdit) setShowNew(true);
  }, [assetParam, canEdit]);
  const closeNew = () => {
    setShowNew(false);
    if (assetParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('asset');
      setSearchParams(next, { replace: true });
    }
  };

  // Deep link to a specific work order: /work-orders?wo=<id> opens its modal
  // (e.g. from the dashboard's overdue list). Cleared when the modal closes.
  const woParam = searchParams.get('wo');
  useEffect(() => {
    if (!woParam || open) return;
    const wo = workOrders.data?.find((w) => w.id === woParam);
    if (wo) setOpen(wo);
  }, [woParam, workOrders.data, open]);
  const closeOpen = () => {
    setOpen(null);
    if (woParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('wo');
      setSearchParams(next, { replace: true });
    }
  };

  const assetName = (id: string | null) =>
    id ? (assets.data?.find((a) => a.id === id)?.name ?? null) : null;
  const userName = (id: string | null) =>
    id ? (users.data?.find((u) => u.id === id)?.name ?? null) : null;

  // IDs of locations in the selected building (plan §5.4).
  const buildingLocationIds = useMemo(() => {
    if (!buildingParam) return null;
    return new Set(
      (locations.data ?? [])
        .filter((l) => l.building_id === buildingParam)
        .map((l) => l.id),
    );
  }, [buildingParam, locations.data]);

  const items = filterByBuilding(workOrders.data ?? [], buildingLocationIds).filter(
    (w) => !sourcePmParam || w.source_pm_id === sourcePmParam,
  );

  // ── Kanban drag-and-drop ──────────────────────────────────────────────────
  const updateWo = useUpdateWorkOrder();
  const [activeWo, setActiveWo] = useState<WorkOrder | null>(null);
  const [dndError, setDndError] = useState<string | null>(null);

  // PointerSensor: 5 px activation distance so a click still fires onClick.
  // KeyboardSensor: columnKeyboardCoordinateGetter makes ArrowLeft/Right jump
  // between columns directly instead of nudging the overlay by pixels.
  // Both respect canEdit — useDraggable's `disabled` prop blocks activation.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinateGetter }),
  );

  function handleDragStart(event: DragStartEvent) {
    const wo = (event.active.data.current as { workOrder: WorkOrder } | undefined)?.workOrder;
    if (wo) setActiveWo(wo);
    setDndError(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveWo(null);
    const { active, over } = event;
    if (!over) return;

    const wo = (active.data.current as { workOrder: WorkOrder } | undefined)?.workOrder;
    if (!wo) return;

    const targetStatus = resolveDropStatus(over.id as string, wo.status);
    if (!targetStatus) return; // same column or unknown → no-op

    updateWo.mutate(
      // WorkOrderUpdate requires priority alongside status; pass through unchanged.
      { id: wo.id, patch: { status: targetStatus, priority: wo.priority } },
      {
        onError: (err) =>
          setDndError((err as Error).message || 'Failed to update status. Please try again.'),
      },
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Work Orders</h1>
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
          {sourcePmParam && (
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <span>Schedule: {sourcePmName}</span>
              <button
                onClick={() => setSearchParams({}, { replace: true })}
                className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-200"
              >
                Clear filter ×
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-300 p-0.5 text-sm">
            {(['board', 'list', 'calendar'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  setDndError(null); // clear stale error banner when switching tabs
                }}
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
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {dndError && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {dndError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((col) => {
              const colItems = items.filter((w) => col.statuses.includes(w.status));
              return (
                <DroppableColumn key={col.label} col={col} count={colItems.length}>
                  {colItems.map((w) => (
                    <DraggableCard
                      key={w.id}
                      wo={w}
                      canDrag={canEdit}
                      assetName={assetName}
                      userName={userName}
                      onClick={() => setOpen(w)}
                    />
                  ))}
                  {colItems.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-slate-400">None</p>
                  )}
                </DroppableColumn>
              );
            })}
          </div>
          <DragOverlay>
            {activeWo && (
              <div className="rounded-lg border border-blue-300 bg-white p-3 text-left shadow-lg ring-2 ring-blue-400 opacity-90">
                <CardContent wo={activeWo} assetName={assetName} userName={userName} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {open && (
        <WorkOrderModal
          wo={open}
          users={users.data ?? []}
          assets={(assets.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
          pmSchedules={(pmSchedules.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
          currency={currency}
          canEdit={canEdit}
          onClose={closeOpen}
        />
      )}
      {showNew && (
        <NewWorkOrderModal
          assets={(assets.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
          users={users.data ?? []}
          initialAssetId={assetParam}
          onClose={closeNew}
        />
      )}
    </div>
  );
}

function NewWorkOrderModal({
  assets,
  users,
  initialAssetId,
  onClose,
}: {
  assets: { id: string; name: string }[];
  users: { id: string; name: string | null; email: string }[];
  initialAssetId?: string | null;
  onClose: () => void;
}) {
  const create = useCreateWorkOrderFromForm();
  const addPhotos = useAddPhotosToWorkOrder();
  const locations = useLocations();
  const vendors = useVendors();
  // Pre-link to an asset when opened from the map (#37); seed the title with its
  // name so the WO reads e.g. "AC1 — " ready for the rest of the summary.
  const initialAsset = initialAssetId ? assets.find((a) => a.id === initialAssetId) : undefined;
  const [f, setF] = useState({
    title: initialAsset ? `${initialAsset.name} — ` : '',
    description: '',
    type: 'reactive',
    priority: 'medium',
    linked_asset_id: initialAsset?.id ?? '',
    location_id: '',
    assignee_user_id: '',
    vendor_id: '',
    due_date: '',
  });
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
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
          const newWo = await create.mutateAsync(parsed.data);
          if (pendingPhotos.length > 0) {
            await addPhotos.mutateAsync({ workOrderId: newWo.id, files: pendingPhotos });
          }
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
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Photos <span className="font-normal text-slate-400">(optional — attached as issue documentation)</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
            + Add photos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) setPendingPhotos((prev) => [...prev, ...files]);
                e.target.value = '';
              }}
            />
          </label>
          {pendingPhotos.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {pendingPhotos.map((file, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="flex-1 truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingPhotos((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 text-slate-400 hover:text-slate-700"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
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
