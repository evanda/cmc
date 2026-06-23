// Request → Work Order conversion (plan §8 — custom logic isolated in shared).
// Triage promotes a raw work request into an open, assignable work order while
// preserving the link back to the originating request.

import type { WorkRequest } from '../types/domain.js';
import type { WorkOrderPriority, WorkOrderStatus, WorkOrderType } from '../types/enums.js';

export interface WorkOrderSeed {
  title: string;
  description: string | null;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  linked_asset_id: string | null;
  location_id: string | null;
  source_request_id: string;
}

/**
 * Build the work-order insert payload for a request being triaged. New WOs start
 * `open` and `reactive`/`medium`; the asset/location link and a back-reference to
 * the request are carried over so the WO joins that asset's history.
 */
export function requestToWorkOrder(request: WorkRequest): WorkOrderSeed {
  return {
    title: request.title,
    description: request.description,
    type: 'reactive',
    priority: 'medium',
    status: 'open',
    linked_asset_id: request.linked_asset_id,
    location_id: request.location_id,
    source_request_id: request.id,
  };
}
