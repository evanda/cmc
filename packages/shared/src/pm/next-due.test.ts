import { describe, expect, it } from 'vitest';
import { addInterval, computeNextDue, isDueWithinLeadTime } from './next-due.js';

describe('addInterval', () => {
  it('adds days', () => {
    expect(addInterval(new Date('2026-01-01T00:00:00Z'), 10, 'day').toISOString()).toBe(
      '2026-01-11T00:00:00.000Z',
    );
  });

  it('adds weeks', () => {
    expect(addInterval(new Date('2026-01-01T00:00:00Z'), 2, 'week').toISOString()).toBe(
      '2026-01-15T00:00:00.000Z',
    );
  });

  it('adds months across a year boundary', () => {
    expect(addInterval(new Date('2026-11-15T00:00:00Z'), 3, 'month').toISOString()).toBe(
      '2027-02-15T00:00:00.000Z',
    );
  });

  it('month: clamps to last day when the target month is shorter (Jan 31 + 3 mo = Apr 30)', () => {
    expect(addInterval(new Date('2026-01-31T00:00:00Z'), 3, 'month').toISOString()).toBe(
      '2026-04-30T00:00:00.000Z',
    );
  });

  it('month: clamps Jan 31 to Feb 28 in a non-leap year', () => {
    expect(addInterval(new Date('2026-01-31T00:00:00Z'), 1, 'month').toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });

  it('month: does not clamp when the target month is long enough (Mar 31 + 3 mo = Jun 30)', () => {
    expect(addInterval(new Date('2026-03-31T00:00:00Z'), 3, 'month').toISOString()).toBe(
      '2026-06-30T00:00:00.000Z',
    );
  });

  it('adds years', () => {
    expect(addInterval(new Date('2026-06-23T00:00:00Z'), 1, 'year').toISOString()).toBe(
      '2027-06-23T00:00:00.000Z',
    );
  });

  it('year: clamps Feb 29 to Feb 28 when advancing from a leap year to a non-leap year', () => {
    expect(addInterval(new Date('2024-02-29T00:00:00Z'), 1, 'year').toISOString()).toBe(
      '2025-02-28T00:00:00.000Z',
    );
  });

  it('rejects non-positive / non-integer intervals', () => {
    expect(() => addInterval(new Date(), 0, 'day')).toThrow();
    expect(() => addInterval(new Date(), -1, 'month')).toThrow();
    expect(() => addInterval(new Date(), 1.5, 'day')).toThrow();
  });
});

describe('computeNextDue', () => {
  it('returns anchor + one quarterly interval (HVAC filter swap, §4.3)', () => {
    const next = computeNextDue(new Date('2026-01-01T00:00:00Z'), {
      type: 'calendar',
      intervalValue: 3,
      intervalUnit: 'month',
    });
    expect(next.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });
});

describe('isDueWithinLeadTime', () => {
  const today = new Date('2026-06-23T00:00:00Z');

  it('is true when due inside the lead window', () => {
    expect(isDueWithinLeadTime(new Date('2026-06-30T00:00:00Z'), today, 14)).toBe(true);
  });

  it('is true when already overdue', () => {
    expect(isDueWithinLeadTime(new Date('2026-06-01T00:00:00Z'), today, 7)).toBe(true);
  });

  it('is false when due beyond the lead window', () => {
    expect(isDueWithinLeadTime(new Date('2026-08-01T00:00:00Z'), today, 14)).toBe(false);
  });
});
