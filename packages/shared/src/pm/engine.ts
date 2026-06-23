// Preventive-Maintenance scheduling engine (plan §4.3).
//
// Pure, backend-agnostic: the daily job / UI maps PM schedule rows to a
// `PmTrigger` + anchor and asks the engine what's due. Calendar + fixed-date
// triggers compute a due *date*; meter triggers compute units-remaining.

import { addInterval, type IntervalUnit } from './next-due.js';
import type { PmAdvanceFrom, PmTriggerType } from '../types/enums.js';

export interface PmTrigger {
  type: PmTriggerType;
  /** calendar: every N units */
  intervalValue?: number | null;
  intervalUnit?: IntervalUnit | null;
  /** meter: service every N units (miles/hours) */
  meterThreshold?: number | null;
  /** fixed_date: a recurring calendar date */
  fixedMonth?: number | null; // 1–12
  fixedDay?: number | null; // 1–31
}

/**
 * Next due date for a calendar/fixed-date trigger (null for meter triggers).
 * - calendar: anchor + one interval.
 * - fixed_date: the next occurrence of month/day strictly after the anchor.
 */
export function nextDueDate(trigger: PmTrigger, anchor: Date): Date | null {
  if (trigger.type === 'calendar') {
    if (!trigger.intervalValue || !trigger.intervalUnit) return null;
    return addInterval(anchor, trigger.intervalValue, trigger.intervalUnit);
  }
  if (trigger.type === 'fixed_date') {
    if (!trigger.fixedMonth || !trigger.fixedDay) return null;
    const year = anchor.getUTCFullYear();
    let due = new Date(Date.UTC(year, trigger.fixedMonth - 1, trigger.fixedDay));
    if (due.getTime() <= anchor.getTime()) {
      due = new Date(Date.UTC(year + 1, trigger.fixedMonth - 1, trigger.fixedDay));
    }
    return due;
  }
  return null;
}

/**
 * The next due date on or after `today` for a recurring schedule — rolls a
 * calendar interval forward past stale anchors (null for meter triggers). Used
 * to show "next due" in the UI.
 */
export function upcomingDueDate(trigger: PmTrigger, anchor: Date, today: Date): Date | null {
  if (trigger.type === 'fixed_date') {
    return nextDueDate(trigger, today < anchor ? anchor : today);
  }
  let due = nextDueDate(trigger, anchor);
  if (!due) return null;
  let guard = 0;
  while (due.getTime() < today.getTime() && guard++ < 1000) {
    const advanced = nextDueDate(trigger, due);
    if (!advanced) break;
    due = advanced;
  }
  return due;
}

/** Units remaining until a meter-triggered PM is due (≤ 0 means due). */
export function meterUnitsRemaining(trigger: PmTrigger, sinceLastService: number): number | null {
  if (trigger.type !== 'meter' || trigger.meterThreshold == null) return null;
  return trigger.meterThreshold - sinceLastService;
}

export interface PmDueContext {
  today: Date;
  leadTimeDays: number;
  /** An open WO already exists for this cycle — don't double-generate (plan §4.3). */
  hasOpenWorkOrder: boolean;
  /** meter triggers: usage since the last service. */
  meterSinceLastService?: number;
}

/**
 * Whether the daily job should generate a work order now: due within the lead
 * window (or meter past threshold) and no open WO already exists for the cycle.
 */
export function shouldGenerateWorkOrder(
  trigger: PmTrigger,
  anchor: Date,
  ctx: PmDueContext,
): boolean {
  if (ctx.hasOpenWorkOrder) return false;
  if (trigger.type === 'meter') {
    const remaining = meterUnitsRemaining(trigger, ctx.meterSinceLastService ?? 0);
    return remaining != null && remaining <= 0;
  }
  const due = nextDueDate(trigger, anchor);
  if (!due) return false;
  const days = Math.ceil((due.getTime() - ctx.today.getTime()) / 86_400_000);
  return days <= ctx.leadTimeDays;
}

/**
 * The schedule's new anchor after a cycle completes. `advance_from: completion`
 * anchors to the completed date (prevents drift-stacking); `scheduled` anchors
 * to the date it was due. (plan §4.3)
 */
export function advanceAnchor(
  trigger: PmTrigger,
  prevAnchor: Date,
  opts: { advanceFrom: PmAdvanceFrom; completedDate: Date; scheduledDate?: Date },
): Date {
  if (opts.advanceFrom === 'completion') return opts.completedDate;
  return opts.scheduledDate ?? nextDueDate(trigger, prevAnchor) ?? prevAnchor;
}
