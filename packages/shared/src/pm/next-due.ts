// Preventive-Maintenance next-due calculator (plan §4.3).
//
// PHASE 0 STUB: only the calendar-interval trigger is implemented — enough to
// anchor the shared engine and prove the package's test wiring. Meter-threshold
// and fixed-date triggers, lead-time WO generation, and drift handling
// ("advance from completion vs scheduled") land in Phase 3.

export type IntervalUnit = 'day' | 'week' | 'month' | 'year';

export interface CalendarTrigger {
  type: 'calendar';
  intervalValue: number;
  intervalUnit: IntervalUnit;
}

/** Add a calendar interval to a date (UTC, day-granularity). */
export function addInterval(from: Date, value: number, unit: IntervalUnit): Date {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`interval value must be a positive integer, got ${value}`);
  }
  const d = new Date(from.getTime());
  switch (unit) {
    case 'day':
      d.setUTCDate(d.getUTCDate() + value);
      break;
    case 'week':
      d.setUTCDate(d.getUTCDate() + value * 7);
      break;
    case 'month':
      d.setUTCMonth(d.getUTCMonth() + value);
      break;
    case 'year':
      d.setUTCFullYear(d.getUTCFullYear() + value);
      break;
  }
  return d;
}

/**
 * Compute the next due date for a calendar-interval PM schedule.
 * @param anchor    The anchor/last-service date.
 * @param trigger   Calendar trigger definition.
 * @returns         The next due date (anchor + one interval).
 */
export function computeNextDue(anchor: Date, trigger: CalendarTrigger): Date {
  return addInterval(anchor, trigger.intervalValue, trigger.intervalUnit);
}

/**
 * Whether a WO should be generated now: due within `leadTimeDays` of `today`.
 * (Phase 3 will also check that no open WO already exists for the cycle.)
 */
export function isDueWithinLeadTime(nextDue: Date, today: Date, leadTimeDays: number): boolean {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.ceil((nextDue.getTime() - today.getTime()) / msPerDay);
  return diffDays <= leadTimeDays;
}
