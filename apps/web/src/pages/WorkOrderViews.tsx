import { useMemo, useState } from 'react';
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type WorkOrder,
  type WorkOrderPriority,
} from '@cmc/shared';
import { inputClass } from '../components/ui';

const priorityStyle: Record<WorkOrderPriority, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

interface ViewProps {
  workOrders: WorkOrder[];
  assetName: (id: string | null) => string | null;
  userName: (id: string | null) => string | null;
  onOpen: (wo: WorkOrder) => void;
}

// ── List view: filterable table of all work (plan §4.6) ──────────────────────
export function WorkOrderList({ workOrders, assetName, userName, onOpen }: ViewProps) {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const rows = useMemo(
    () =>
      workOrders.filter(
        (w) => (!status || w.status === status) && (!priority || w.priority === priority),
      ),
    [workOrders, status, priority],
  );

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <select className={inputClass + ' max-w-[12rem]'} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {WORK_ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className={inputClass + ' max-w-[12rem]'} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {WORK_ORDER_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Work order</th>
              <th className="px-4 py-2 font-medium">Asset</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Priority</th>
              <th className="px-4 py-2 font-medium">Assignee</th>
              <th className="px-4 py-2 font-medium">Due / done</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((w) => (
              <tr key={w.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(w)}>
                <td className="px-4 py-2.5 font-medium text-slate-800">{w.title}</td>
                <td className="px-4 py-2.5 text-slate-600">{assetName(w.linked_asset_id) ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">{w.status}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${priorityStyle[w.priority]}`}>
                    {w.priority}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{userName(w.assignee_user_id) ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {w.completed_date ?? w.due_date ?? '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  No work orders match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Calendar view: month grid of scheduled/due/completed work (plan §4.6) ────
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function WorkOrderCalendar({ workOrders, onOpen }: ViewProps) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // WOs keyed by their relevant date (completed, else due, else scheduled).
  const byDay = useMemo(() => {
    const map = new Map<string, WorkOrder[]>();
    for (const w of workOrders) {
      const day = w.completed_date ?? w.due_date ?? w.scheduled_date;
      if (!day) continue;
      const list = map.get(day) ?? [];
      list.push(w);
      map.set(day, list);
    }
    return map;
  }, [workOrders]);

  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDow = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const iso = (d: number) =>
    `${year}-${String(mon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button
          className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
          onClick={() => setMonth(new Date(year, mon - 1, 1))}
        >
          ‹
        </button>
        <span className="text-sm font-medium text-slate-700">
          {month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
          onClick={() => setMonth(new Date(year, mon + 1, 1))}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        {DOW.map((d) => (
          <div key={d} className="border-b border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const items = day ? (byDay.get(iso(day)) ?? []) : [];
          return (
            <div key={i} className="min-h-[88px] border-b border-r border-slate-100 p-1 align-top">
              {day && (
                <div
                  className={`mb-1 text-xs ${iso(day) === todayIso ? 'font-bold text-blue-600' : 'text-slate-400'}`}
                >
                  {day}
                </div>
              )}
              <div className="space-y-1">
                {items.slice(0, 3).map((w) => (
                  <button
                    key={w.id}
                    onClick={() => onOpen(w)}
                    className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] ${priorityStyle[w.priority]}`}
                    title={w.title}
                  >
                    {w.title}
                  </button>
                ))}
                {items.length > 3 && (
                  <div className="px-1 text-[10px] text-slate-400">+{items.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
