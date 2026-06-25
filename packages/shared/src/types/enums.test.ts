import { describe, expect, it } from 'vitest';
import { WO_FILING_ROLES, COST_VISIBLE_ROLES, USER_ROLES } from './enums.js';

describe('role permission constants', () => {
  describe('WO_FILING_ROLES', () => {
    it('includes admin, technician, and requester', () => {
      expect(WO_FILING_ROLES).toContain('admin');
      expect(WO_FILING_ROLES).toContain('technician');
      expect(WO_FILING_ROLES).toContain('requester');
    });

    it('excludes trustee (financial/oversight only)', () => {
      expect(WO_FILING_ROLES).not.toContain('trustee');
    });

    it('excludes vendor', () => {
      expect(WO_FILING_ROLES).not.toContain('vendor');
    });

    it('is a subset of USER_ROLES', () => {
      for (const role of WO_FILING_ROLES) {
        expect(USER_ROLES).toContain(role);
      }
    });
  });

  describe('COST_VISIBLE_ROLES', () => {
    it('includes trustee but not requester (plan §7.5)', () => {
      expect(COST_VISIBLE_ROLES).toContain('trustee');
      expect(COST_VISIBLE_ROLES).not.toContain('requester');
    });
  });
});
