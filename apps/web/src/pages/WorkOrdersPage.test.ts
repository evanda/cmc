import { describe, expect, it, vi } from 'vitest';
import { WORK_ORDER_STATUSES, type WorkOrder } from '@cmc/shared';
import {
  columns,
  columnDropStatus,
  columnKeyboardCoordinateGetter,
  filterByBuilding,
  resolveDropStatus,
} from './WorkOrdersPage';

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

// ── columnKeyboardCoordinateGetter ────────────────────────────────────────────
// Helpers to build minimal mock objects the getter needs.

function makeRect(left: number, width: number): DOMRect {
  return { left, right: left + width, top: 0, bottom: 600, width, height: 600 } as DOMRect;
}

function makeContainers(rects: Record<string, DOMRect>) {
  const map = new Map(
    Object.entries(rects).map(([label, rect]) => [
      label,
      { rect: { current: rect } },
    ]),
  );
  return map as unknown as Parameters<
    typeof columnKeyboardCoordinateGetter
  >[1]['context']['droppableContainers'];
}

function makeEvent(code: string): KeyboardEvent {
  const event = { code, preventDefault: vi.fn() } as unknown as KeyboardEvent;
  return event;
}

// Place 4 columns side by side, each 300 px wide.
const COL_WIDTH = 300;
const colRects: Record<string, DOMRect> = Object.fromEntries(
  columns.map((col, i) => [col.label, makeRect(i * COL_WIDTH, COL_WIDTH)]),
);

function callGetter(code: string, currentX: number, currentY = 200) {
  return columnKeyboardCoordinateGetter(makeEvent(code), {
    currentCoordinates: { x: currentX, y: currentY },
    context: { droppableContainers: makeContainers(colRects) } as never,
    active: 'some-id',
  });
}

describe('columnKeyboardCoordinateGetter', () => {
  it('returns undefined for ArrowUp (no vertical movement in a non-sortable kanban)', () => {
    expect(callGetter('ArrowUp', COL_WIDTH / 2)).toBeUndefined();
  });

  it('returns undefined for ArrowDown', () => {
    expect(callGetter('ArrowDown', COL_WIDTH / 2)).toBeUndefined();
  });

  it('returns undefined for unrelated keys', () => {
    expect(callGetter('Enter', COL_WIDTH / 2)).toBeUndefined();
  });

  it('ArrowRight from column 0 returns center of column 1', () => {
    const col0CenterX = COL_WIDTH / 2;
    const result = callGetter('ArrowRight', col0CenterX);
    const expectedX = COL_WIDTH + COL_WIDTH / 2; // center of column 1
    expect(result).toEqual({ x: expectedX, y: 200 });
  });

  it('ArrowLeft from column 1 returns center of column 0', () => {
    const col1CenterX = COL_WIDTH + COL_WIDTH / 2;
    const result = callGetter('ArrowLeft', col1CenterX);
    expect(result).toEqual({ x: COL_WIDTH / 2, y: 200 });
  });

  it('preserves the current y coordinate', () => {
    const result = callGetter('ArrowRight', COL_WIDTH / 2, 42);
    expect(result?.y).toBe(42);
  });

  it('ArrowRight on the last column returns undefined (already at edge)', () => {
    const lastColCenterX = (columns.length - 1) * COL_WIDTH + COL_WIDTH / 2;
    expect(callGetter('ArrowRight', lastColCenterX)).toBeUndefined();
  });

  it('ArrowLeft on the first column returns undefined (already at edge)', () => {
    const firstColCenterX = COL_WIDTH / 2;
    expect(callGetter('ArrowLeft', firstColCenterX)).toBeUndefined();
  });

  it('ArrowRight traverses all columns in order', () => {
    const expectedCenterXs = columns.map((_, i) => i * COL_WIDTH + COL_WIDTH / 2);
    let x = expectedCenterXs[0];
    for (let i = 1; i < columns.length; i++) {
      const result = callGetter('ArrowRight', x);
      expect(result?.x).toBe(expectedCenterXs[i]);
      x = expectedCenterXs[i];
    }
  });
});
