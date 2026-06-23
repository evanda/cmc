import { describe, expect, it } from 'vitest';
import type { WorkRequest } from '../types/domain.js';
import { requestToWorkOrder } from './convert.js';

const baseRequest: WorkRequest = {
  id: 'req-1',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  created_by: 'user-1',
  deleted_at: null,
  title: 'AC out in Room 12',
  description: 'No cold air since this morning.',
  requested_by: 'user-1',
  location_id: 'loc-12',
  linked_asset_id: 'asset-rtu',
  status: 'open',
  photo_url: null,
};

describe('requestToWorkOrder', () => {
  it('carries title/description/asset/location and back-links the request', () => {
    const wo = requestToWorkOrder(baseRequest);
    expect(wo).toMatchObject({
      title: 'AC out in Room 12',
      description: 'No cold air since this morning.',
      linked_asset_id: 'asset-rtu',
      location_id: 'loc-12',
      source_request_id: 'req-1',
    });
  });

  it('starts the WO open / reactive / medium', () => {
    const wo = requestToWorkOrder(baseRequest);
    expect(wo.status).toBe('open');
    expect(wo.type).toBe('reactive');
    expect(wo.priority).toBe('medium');
  });

  it('preserves null asset/location when the request had none', () => {
    const wo = requestToWorkOrder({ ...baseRequest, linked_asset_id: null, location_id: null });
    expect(wo.linked_asset_id).toBeNull();
    expect(wo.location_id).toBeNull();
  });
});
