import { useState } from 'react';
import {
  PM_INTERVAL_UNITS,
  PM_TRIGGER_TYPES,
  pmScheduleFormSchema,
  upcomingDueDate,
  type PmSchedule,
  type PmTrigger,
} from '@cmc/shared';
import {
  useAssets,
  useCreatePmSchedule,
  useDeletePmSchedule,
  usePmSchedules,
  useRunPmJob,
  useUsers,
} from '../lib/queries';
import { useAuth } from '../auth/AuthProvider';
import { Button, EmptyState, Field, Modal, inputClass } from '../components/ui';

const TODAY = new Date();

function triggerOf(s: PmSchedule): PmTrigger {
  return {
    type: s.trigger_type,
    intervalValue: s.interval_value,
    intervalUnit: s.interval_unit,
    meterThreshold: s.meter_threshold,
    fixedMonth: s.fixed_month,
    fixedDay: s.fixed_day,
  };
}

function triggerSummary(s: PmSchedule): string {
  if (s.trigger_type === 'calendar' && s.interval_value && s.interval_unit)
    return `every ${s.interval_value} ${s.interval_unit}${s.interval_value > 1 ? 's' : ''}`;
  if (s.trigger_type === 'fixed_date' && s.fixed_month && s.fixed_day)
    return `annually on ${s.fixed_month}/${s.fixed_day}`;
  if (s.trigger_type === 'meter' && s.meter_threshold) return `every ${s.meter_threshold} units`;
  return s.trigger_type;
}

export function PmSchedulesPage() {
  const { role } = useAuth();
  const canEdit = role === 'admin' || role === 'technician';
  const schedules = usePmSchedules();
  const assets = useAssets();
  const remove = useDeletePmSchedule();
  const runJob = useRunPmJob();
  const [showForm, setShowForm] = useState(false);

  const assetName = (id: string | null) =>
    id ? (assets.data?.find((a) => a.id === id)?.name ?? null) : null;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Maintenance Schedules</h1>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => runJob.mutate()} disabled={runJob.isPending}>
              {runJob.isPending ? 'Generating…' : 'Generate due work orders'}
            </Button>
            <Button onClick={() => setShowForm(true)}>+ New maintenance schedule</Button>
          </div>
        )}
      </div>
      <p className="mb-2 text-sm text-slate-500">
        Recurring scheduled work. The engine computes each schedule&apos;s next-due date and
        generates a work order ahead of it — automatically every night, or on demand via
        &ldquo;Generate due work orders&rdquo;.
      </p>
      {runJob.isSuccess && (
        <p className="mb-4 text-sm text-green-700">
          Generated {runJob.data.generated} work order{runJob.data.generated === 1 ? '' : 's'}
          {runJob.data.skipped > 0 && ` · ${runJob.data.skipped} already had an open one`}.
        </p>
      )}
      {runJob.isError && (
        <p className="mb-4 text-sm text-red-700">
          Couldn&apos;t generate work orders: {(runJob.error as Error).message}
        </p>
      )}

      {schedules.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : schedules.data && schedules.data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Schedule</th>
                <th className="px-4 py-2 font-medium">Asset</th>
                <th className="px-4 py-2 font-medium">Trigger</th>
                <th className="px-4 py-2 font-medium">Next due</th>
                {canEdit && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schedules.data.map((s) => {
                const due = upcomingDueDate(triggerOf(s), new Date(s.anchor_date), TODAY);
                const days = due
                  ? Math.ceil((due.getTime() - TODAY.getTime()) / 86_400_000)
                  : null;
                const soon = days != null && days <= s.lead_time_days;
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 font-medium text-slate-800">
                        {s.name}
                        {s.is_compliance && (
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700">
                            compliance
                          </span>
                        )}
                      </div>
                      {s.category && <div className="text-xs text-slate-400">{s.category}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{assetName(s.asset_id) ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{triggerSummary(s)}</td>
                    <td className="px-4 py-2.5">
                      {due ? (
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            soon ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {due.toISOString().slice(0, 10)}
                          {days != null && ` · ${days}d`}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">meter-based</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="danger"
                          onClick={() => confirm(`Delete "${s.name}"?`) && remove.mutate(s.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No maintenance schedules yet.</EmptyState>
      )}

      {showForm && (
        <PmForm
          assets={(assets.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function PmForm({
  assets,
  onClose,
}: {
  assets: { id: string; name: string }[];
  onClose: () => void;
}) {
  const create = useCreatePmSchedule();
  const users = useUsers();
  const [f, setF] = useState({
    name: '',
    asset_id: '',
    trigger_type: 'calendar',
    interval_value: '3',
    interval_unit: 'month',
    fixed_month: '',
    fixed_day: '',
    meter_threshold: '',
    anchor_date: new Date().toISOString().slice(0, 10),
    lead_time_days: '14',
    assignee_user_id: '',
    category: '',
    is_compliance: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Modal title="New maintenance schedule" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = pmScheduleFormSchema.safeParse({
            ...f,
            asset_id: f.asset_id || null,
            assignee_user_id: f.assignee_user_id || null,
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
        <Field label="Name" error={errors.name}>
          <input className={inputClass} value={f.name} onChange={set('name')} placeholder="HVAC filter swap" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Asset (optional)">
            <select className={inputClass} value={f.asset_id} onChange={set('asset_id')}>
              <option value="">— campus-wide —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trigger">
            <select className={inputClass} value={f.trigger_type} onChange={set('trigger_type')}>
              {PM_TRIGGER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          {f.trigger_type === 'calendar' && (
            <>
              <Field label="Every">
                <input className={inputClass} value={f.interval_value} onChange={set('interval_value')} />
              </Field>
              <Field label="Unit">
                <select className={inputClass} value={f.interval_unit} onChange={set('interval_unit')}>
                  {PM_INTERVAL_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          {f.trigger_type === 'fixed_date' && (
            <>
              <Field label="Month (1–12)">
                <input className={inputClass} value={f.fixed_month} onChange={set('fixed_month')} />
              </Field>
              <Field label="Day (1–31)">
                <input className={inputClass} value={f.fixed_day} onChange={set('fixed_day')} />
              </Field>
            </>
          )}
          {f.trigger_type === 'meter' && (
            <Field label="Every N units">
              <input className={inputClass} value={f.meter_threshold} onChange={set('meter_threshold')} />
            </Field>
          )}

          <Field label="Anchor / last service" error={errors.anchor_date}>
            <input type="date" className={inputClass} value={f.anchor_date} onChange={set('anchor_date')} />
          </Field>
          <Field label="Lead time (days)">
            <input className={inputClass} value={f.lead_time_days} onChange={set('lead_time_days')} />
          </Field>
          <Field label="Assignee">
            <select className={inputClass} value={f.assignee_user_id} onChange={set('assignee_user_id')}>
              <option value="">Unassigned</option>
              {users.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <input className={inputClass} value={f.category} onChange={set('category')} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={f.is_compliance}
            onChange={(e) => setF((p) => ({ ...p, is_compliance: e.target.checked }))}
          />
          Compliance item (surfaces on the compliance dashboard)
        </label>
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
