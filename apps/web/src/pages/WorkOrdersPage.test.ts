import { describe, expect, it } from 'vitest';
import { WORK_ORDER_STATUSES, type WorkOrder } from '@cmc/shared';
import { columns, columnDropStatus, filterByBuilding, resolveDropStatus } from './WorkOrdersPage';

// Unit tests for the pure board-DnD logic. These don't render any component or
// touch @dnd-kit — they test the data declarations and the resolveDropStatus
// helper that handleDragEnd delegates to.

describe('kanban board column config', () => {
  it('every columnDropStatus value is a valid WorkOrderStatus', () => {
    for (const status of Object.values(columnDropStatus)) {
      expect(WORK_ORDER_STATUSES).toContain(status);
    }
  });

  it('each columnDropStatus entry is contained in its own column statuses array', () => {
    for (const [label, targetStatus] of Object.entries(columnDropStatus)) {
      const col = columns.find((c) => c.label === label);
      expect(col, `column "${label}" not found`).toBeTruthy();
      expect(col!.statuses).toContain(targetStatus);
    }
  });

  it('every column has an entry in columnDropStatus', () => {
    for (const col of columns) {
      expect(columnDropStatus).toHaveProperty(col.label);
    }
  });

  it('no two columns share a status', () => {
    const seen = new Set<string>();
    for (const col of columns) {
      for (const s of col.statuses) {
        expect(seen.has(s), `status "${s}" appears in multiple columns`).toBe(false);
        seen.add(s);
      }
    }
  });
});

// Minimal WorkOrder stub with only the fields filterByBuilding inspects.
function wo(id: string, location_id: string | null): WorkOrder {
  return { id, location_id, status: 'open', priority: 'medium' } as unknown as WorkOrder;
}

describe('filterByBuilding', () => {
  const orders = [
    wo('a', 'loc1'),
    wo('b', 'loc2'),
    wo('c', null),
    wo('d', 'loc3'),
  ];

  it('returns all orders when buildingLocationIds is null (no filter)', () => {
    expect(filterByBuilding(orders, null)).toHaveLength(4);
  });

  it('returns only orders whose location_id is in the set', () => {
    const ids = new Set(['loc1', 'loc3']);
    const result = filterByBuilding(orders, ids);
    expect(result.map((w) => w.id)).toEqual(['a', 'd']);
  });

  it('excludes orders with null location_id even if the set is non-empty', () => {
    const ids = new Set(['loc1']);
    const result = filterByBuilding(orders, ids);
    expect(result.map((w) => w.id)).toEqual(['a']);
  });

  it('returns empty array when no orders match', () => {
    const ids = new Set(['loc99']);
    expect(filterByBuilding(orders, ids)).toHaveLength(0);
  });
});

describe('resolveDropStatus', () => {
  it('returns null for an unknown column label', () => {
    expect(resolveDropStatus('Nonexistent', 'open')).toBeNull();
  });

  it('returns null when the card is already in the target column (no-op)', () => {
    // 'open' and 'requested' both live in the Open column
    expect(resolveDropStatus('Open', 'open')).toBeNull();
    expect(resolveDropStatus('Open', 'requested')).toBeNull();
    expect(resolveDropStatus('In progress', 'in_progress')).toBeNull();
    expect(resolveDropStatus('On hold', 'on_hold')).toBeNull();
    // 'completed' and 'closed' both live in the Completed column
    expect(resolveDropStatus('Completed', 'completed')).toBeNull();
    expect(resolveDropStatus('Completed', 'closed')).toBeNull();
  });

  it('returns the canonical target status when moving to a different column', () => {
    expect(resolveDropStatus('In progress', 'open')).toBe('in_progress');
    expect(resolveDropStatus('In progress', 'requested')).toBe('in_progress');
    expect(resolveDropStatus('On hold', 'in_progress')).toBe('on_hold');
    expect(resolveDropStatus('Completed', 'in_progress')).toBe('completed');
    expect(resolveDropStatus('Open', 'in_progress')).toBe('open');
    expect(resolveDropStatus('Open', 'on_hold')).toBe('open');
  });
});
