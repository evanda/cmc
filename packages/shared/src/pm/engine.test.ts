import { describe, expect, it } from 'vitest';
import {
  advanceAnchor,
  meterUnitsRemaining,
  nextDueDate,
  shouldGenerateWorkOrder,
  upcomingDueDate,
  type PmTrigger,
} from './engine.js';

const calendar: PmTrigger = { type: 'calendar', intervalValue: 3, intervalUnit: 'month' };
const fixed: PmTrigger = { type: 'fixed_date', fixedMonth: 4, fixedDay: 15 }; // annual backflow
const meter: PmTrigger = { type: 'meter', meterThreshold: 5000 };

describe('nextDueDate', () => {
  it('calendar: anchor + one interval', () => {
    expect(nextDueDate(calendar, new Date('2026-01-01T00:00:00Z'))?.toISOString()).toBe(
      '2026-04-01T00:00:00.000Z',
    );
  });

  it('fixed_date: next occurrence after anchor (same year)', () => {
    expect(nextDueDate(fixed, new Date('2026-01-10T00:00:00Z'))?.toISOString()).toBe(
      '2026-04-15T00:00:00.000Z',
    );
  });

  it('fixed_date: rolls to next year when the date has passed', () => {
    expect(nextDueDate(fixed, new Date('2026-05-01T00:00:00Z'))?.toISOString()).toBe(
      '2027-04-15T00:00:00.000Z',
    );
  });

  it('meter triggers have no due date', () => {
    expect(nextDueDate(meter, new Date('2026-01-01T00:00:00Z'))).toBeNull();
  });
});

describe('upcomingDueDate', () => {
  const today = new Date('2026-06-23T00:00:00Z');

  it('rolls a stale calendar anchor forward to the next future due', () => {
    // quarterly from 2026-01-01 → 04-01 (past) → 07-01 (next future)
    expect(upcomingDueDate(calendar, new Date('2026-01-01T00:00:00Z'), today)?.toISOString()).toBe(
      '2026-07-01T00:00:00.000Z',
    );
  });

  it('fixed_date: next occurrence on/after today', () => {
    expect(upcomingDueDate(fixed, new Date('2020-01-01T00:00:00Z'), today)?.toISOString()).toBe(
      '2027-04-15T00:00:00.000Z',
    );
  });

  it('meter triggers return null (no date-based due; use meterUnitsRemaining instead)', () => {
    expect(upcomingDueDate(meter, new Date('2026-01-01T00:00:00Z'), today)).toBeNull();
  });

  it('calendar: anchor in the future returns anchor + interval (not yet stale)', () => {
    // anchor 2026-08-01 is after today; next due = 2026-11-01
    expect(
      upcomingDueDate(calendar, new Date('2026-08-01T00:00:00Z'), today)?.toISOString(),
    ).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('meterUnitsRemaining', () => {
  it('counts down from the threshold', () => {
    expect(meterUnitsRemaining(meter, 4200)).toBe(800);
    expect(meterUnitsRemaining(meter, 5200)).toBe(-200); // overdue
  });
});

describe('shouldGenerateWorkOrder', () => {
  const today = new Date('2026-03-25T00:00:00Z');

  it('calendar: generates when due within the lead window', () => {
    // due 2026-04-01, today 2026-03-25, lead 14 → 7 days out → generate
    const r = shouldGenerateWorkOrder(calendar, new Date('2026-01-01T00:00:00Z'), {
      today,
      leadTimeDays: 14,
      hasOpenWorkOrder: false,
    });
    expect(r).toBe(true);
  });

  it('calendar: does not generate when due beyond the lead window', () => {
    const r = shouldGenerateWorkOrder(calendar, new Date('2026-02-01T00:00:00Z'), {
      today,
      leadTimeDays: 7,
      hasOpenWorkOrder: false,
    });
    expect(r).toBe(false); // due 2026-05-01
  });

  it('never double-generates when an open WO exists', () => {
    const r = shouldGenerateWorkOrder(calendar, new Date('2026-01-01T00:00:00Z'), {
      today,
      leadTimeDays: 14,
      hasOpenWorkOrder: true,
    });
    expect(r).toBe(false);
  });

  it('meter: generates once usage reaches the threshold', () => {
    const ctx = { today, leadTimeDays: 0, hasOpenWorkOrder: false };
    expect(shouldGenerateWorkOrder(meter, today, { ...ctx, meterSinceLastService: 4999 })).toBe(
      false,
    );
    expect(shouldGenerateWorkOrder(meter, today, { ...ctx, meterSinceLastService: 5000 })).toBe(
      true,
    );
  });

  it('meter: does not double-generate when an open WO already exists', () => {
    const r = shouldGenerateWorkOrder(meter, today, {
      today,
      leadTimeDays: 0,
      hasOpenWorkOrder: true,
      meterSinceLastService: 9999,
    });
    expect(r).toBe(false);
  });

  it('fixed_date: generates when the next annual date is within lead window', () => {
    // fixed April 15; today March 25 → 21 days out; lead 30 → should generate
    const r = shouldGenerateWorkOrder(fixed, new Date('2025-04-15T00:00:00Z'), {
      today,
      leadTimeDays: 30,
      hasOpenWorkOrder: false,
    });
    expect(r).toBe(true);
  });

  it('fixed_date: does not generate when beyond the lead window', () => {
    // fixed April 15; today March 25 → 21 days out; lead 7 → skip
    const r = shouldGenerateWorkOrder(fixed, new Date('2025-04-15T00:00:00Z'), {
      today,
      leadTimeDays: 7,
      hasOpenWorkOrder: false,
    });
    expect(r).toBe(false);
  });

  it('fixed_date: does not double-generate when an open WO exists', () => {
    const r = shouldGenerateWorkOrder(fixed, new Date('2025-04-15T00:00:00Z'), {
      today,
      leadTimeDays: 60,
      hasOpenWorkOrder: true,
    });
    expect(r).toBe(false);
  });
});

describe('advanceAnchor', () => {
  const prev = new Date('2026-01-01T00:00:00Z');

  it('advance_from completion anchors to the completed date (no drift)', () => {
    const next = advanceAnchor(calendar, prev, {
      advanceFrom: 'completion',
      completedDate: new Date('2026-04-05T00:00:00Z'), // done 4 days late
    });
    expect(next.toISOString()).toBe('2026-04-05T00:00:00.000Z');
    // so the next due is 3 months from completion, not from the original anchor
    expect(nextDueDate(calendar, next)?.toISOString()).toBe('2026-07-05T00:00:00.000Z');
  });

  it('advance_from scheduled anchors to the scheduled due date', () => {
    const next = advanceAnchor(calendar, prev, {
      advanceFrom: 'scheduled',
      completedDate: new Date('2026-04-05T00:00:00Z'),
      scheduledDate: new Date('2026-04-01T00:00:00Z'),
    });
    expect(next.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('advance_from scheduled without a scheduledDate falls back to prevAnchor (meter trigger has no date)', () => {
    // meter triggers have no nextDueDate; without scheduledDate, the anchor stays put
    const next = advanceAnchor(meter, prev, {
      advanceFrom: 'scheduled',
      completedDate: new Date('2026-04-05T00:00:00Z'),
    });
    expect(next.toISOString()).toBe(prev.toISOString());
  });

  it('advance_from completion always uses the completed date, even for meter triggers', () => {
    const completed = new Date('2026-04-05T00:00:00Z');
    const next = advanceAnchor(meter, prev, { advanceFrom: 'completion', completedDate: completed });
    expect(next.toISOString()).toBe(completed.toISOString());
  });

  it('advance_from completion when done early: anchor moves forward but less than one full interval', () => {
    // WO completed 5 days BEFORE the due date (2026-03-27 < 2026-04-01).
    // With advance_from = completion the anchor is the early date, so the
    // next cycle starts from there — the interval effectively shrinks by 5 days.
    const early = new Date('2026-03-27T00:00:00Z');
    const next = advanceAnchor(calendar, prev, { advanceFrom: 'completion', completedDate: early });
    expect(next.toISOString()).toBe('2026-03-27T00:00:00.000Z');
    expect(nextDueDate(calendar, next)?.toISOString()).toBe('2026-06-27T00:00:00.000Z');
  });

  it('advance_from scheduled when done early: anchor stays at the due date, not the early completion', () => {
    // Same early completion but advance_from = scheduled: the due date is
    // anchor + interval = 2026-04-01.  The schedule keeps its rhythm.
    const next = advanceAnchor(calendar, prev, {
      advanceFrom: 'scheduled',
      completedDate: new Date('2026-03-27T00:00:00Z'),
      scheduledDate: new Date('2026-04-01T00:00:00Z'),
    });
    expect(next.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(nextDueDate(calendar, next)?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });
});
