// Domain enums shared across web / mobile / loader. Kept in sync with the
// Postgres enum types declared in supabase/migrations (plan §6, §7.5).

/** Auth roles (plan §7.5). RLS policies key off these. */
export const USER_ROLES = ['admin', 'technician', 'requester', 'trustee', 'vendor'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Asset criticality (plan §4.1). */
export const CRITICALITIES = ['low', 'medium', 'high'] as const;
export type Criticality = (typeof CRITICALITIES)[number];

/** Asset lifecycle status (plan §4.1). */
export const ASSET_STATUSES = ['active', 'retired'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

/** Roles that may see cost/financial data (plan §7.5). */
export const COST_VISIBLE_ROLES: readonly UserRole[] = ['admin', 'technician', 'trustee'];

/** Work-order type / priority / status (plan §4.2). */
export const WORK_ORDER_TYPES = ['reactive', 'preventive', 'inspection'] as const;
export type WorkOrderType = (typeof WORK_ORDER_TYPES)[number];

export const WORK_ORDER_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];

export const WORK_ORDER_STATUSES = [
  'requested',
  'open',
  'in_progress',
  'on_hold',
  'completed',
  'closed',
  'cancelled',
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];
