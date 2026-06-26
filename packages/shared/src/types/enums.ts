// Domain enums shared across web / mobile / loader. Kept in sync with the
// Postgres enum types declared in supabase/migrations (plan §6, §7.5).

/** Auth roles (plan §7.5). RLS policies key off these. */
export const USER_ROLES = ['admin', 'technician', 'requester', 'trustee', 'vendor'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Human-readable role labels for UI and emails (e.g. invite emails, §3/§7.5). */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  technician: 'Technician',
  requester: 'Requester',
  trustee: 'Trustee',
  vendor: 'Vendor',
};

/** Display label for a role, falling back to the raw value if unrecognized. */
export function roleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}

/** Asset criticality (plan §4.1). */
export const CRITICALITIES = ['low', 'medium', 'high'] as const;
export type Criticality = (typeof CRITICALITIES)[number];

/** Asset lifecycle status (plan §4.1). */
export const ASSET_STATUSES = ['active', 'retired'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

/** Roles that may see cost/financial data (plan §7.5). */
export const COST_VISIBLE_ROLES: readonly UserRole[] = ['admin', 'technician', 'trustee'];

/** Roles that may file work orders (plan §7.5 — Trustee is financial/oversight only). */
export const WO_FILING_ROLES: readonly UserRole[] = ['admin', 'technician', 'requester'];

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

/** Work-order photo kind: 'before' (damage) vs 'after' (proof of repair). */
export const WORK_ORDER_PHOTO_KINDS = ['before', 'after'] as const;
export type WorkOrderPhotoKind = (typeof WORK_ORDER_PHOTO_KINDS)[number];

/** WO statuses that count as "active work" for board columns / dashboards. */
export const ACTIVE_WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = [
  'requested',
  'open',
  'in_progress',
  'on_hold',
];

/** Preventive-maintenance trigger / interval / anchor enums (plan §4.3). */
export const PM_TRIGGER_TYPES = ['calendar', 'meter', 'fixed_date'] as const;
export type PmTriggerType = (typeof PM_TRIGGER_TYPES)[number];

export const PM_INTERVAL_UNITS = ['day', 'week', 'month', 'year'] as const;
export type PmIntervalUnit = (typeof PM_INTERVAL_UNITS)[number];

export const PM_ADVANCE_FROM = ['completion', 'scheduled'] as const;
export type PmAdvanceFrom = (typeof PM_ADVANCE_FROM)[number];
