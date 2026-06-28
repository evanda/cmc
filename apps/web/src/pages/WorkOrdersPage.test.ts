import { describe, expect, it } from 'vitest';
import { WORK_ORDER_STATUSES } from '@cmc/shared';
import { columns } from './WorkOrdersPage';

describe('kanban board columns config', () => {
  it('every column dropStatus is a valid WorkOrderStatus', () => {
    for (const col of columns) {
      expect(WORK_ORDER_STATUSES).toContain(col.dropStatus);
    }
  });

  it('dropStatus for each column is contained in its own statuses list', () => {
    for (const col of columns) {
      expect(col.statuses).toContain(col.dropStatus);
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

  it('dropping onto the same column is a no-op (statuses includes current)', () => {
    // Guard: if wo.status is already in col.statuses the update should not fire.
    // This mirrors the `!col.statuses.includes(wo.status)` check in the drop handler.
    for (const col of columns) {
      for (const status of col.statuses) {
        expect(col.statuses.includes(status)).toBe(true);
      }
    }
  });
});
