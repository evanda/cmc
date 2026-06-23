// Phase 0 domain types (plan §6 — schema source of truth).
// Only the foundation entities are modelled here; later phases (work orders,
// PM schedules, vendors, POIs, …) extend this file as those tables land.
//
// NOTE: these are `type` aliases, not `interface`s, on purpose — the Supabase
// typed client constrains table rows to `Record<string, unknown>`, which object
// `type` literals satisfy but interfaces do not (no implicit index signature).

import type {
  AssetStatus,
  Criticality,
  UserRole,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from './enums.js';

/** Columns every table carries (plan §6 preamble). */
export type BaseRow = {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  deleted_at: string | null;
};

/** Single-row church identity / branding (plan §7.6). NOT church-hardcoded. */
export type OrgSettings = BaseRow & {
  facility_name: string;
  logo_url: string | null;
  address: string | null;
  locale: string;
  /** Distance units for meters/fleet, e.g. 'mi' | 'km'. */
  distance_unit: string;
  currency: string;
  timezone: string;
  theme: Record<string, unknown> | null;
  /** Org-wide maintenance contact (a mail list); per-asset contact overrides it. */
  maintenance_contact_email: string | null;
};

/** App users + their role (plan §6 users, §7.5). Mirrors auth.users by id. */
export type User = BaseRow & {
  name: string | null;
  email: string;
  role: UserRole;
};

export type Building = BaseRow & {
  name: string;
  description: string | null;
  address: string | null;
  footprint_geojson: GeoJsonPolygon | null;
};

export type Floor = BaseRow & {
  building_id: string;
  name: string;
  /** Integer level: -1 = B1, 0/1 = ground, 2… (plan §5.2). */
  level: number;
  floorplan_image_url: string | null;
  geo_corners_geojson: GeoJsonPolygon | null;
  rotation_deg: number | null;
};

export type Location = BaseRow & {
  building_id: string;
  floor_id: string | null;
  name: string;
  /** room | area | … (free text for v1, plan §6). */
  type: string | null;
};

export type AssetCategory = BaseRow & {
  name: string;
  parent_id: string | null;
};

export type Asset = BaseRow & {
  name: string;
  category_id: string | null;
  parent_asset_id: string | null;
  location_id: string | null;
  make: string | null;
  model: string | null;
  serial: string | null;
  install_date: string | null;
  purchase_cost: number | null;
  expected_life_years: number | null;
  replacement_cost: number | null;
  warranty_expiry: string | null;
  criticality: Criticality;
  status: AssetStatus;
  /** Stable unguessable slug for QR deep links; null until tagged (plan §3). */
  qr_token: string | null;
  notes: string | null;
  /** Per-asset point of contact (plan §4.5); falls back to org maintenance email. */
  contact_name: string | null;
  contact_email: string | null;
};

/** One photo of an asset; multiple per asset, one primary (plan §4.1, §6). */
export type AssetPhoto = BaseRow & {
  asset_id: string;
  url: string;
  caption: string | null;
  is_primary: boolean;
  taken_at: string | null;
};

/** A work order — also the asset's service-history record (plan §4.2). */
export type WorkOrder = BaseRow & {
  title: string;
  description: string | null;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  linked_asset_id: string | null;
  location_id: string | null;
  requested_by: string | null;
  assignee_user_id: string | null;
  coordinated_by_user_id: string | null;
  authorized_by_user_id: string | null;
  vendor_name: string | null;
  estimate_cost: number | null;
  actual_parts_cost: number | null;
  actual_labor_cost: number | null;
  actual_vendor_cost: number | null;
  labor_hours: number | null;
  invoice_number: string | null;
  invoice_url: string | null;
  /** Check / payment number. */
  payment_reference: string | null;
  scheduled_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  completion_notes: string | null;
};

// Minimal GeoJSON shapes used by the spatial schema (full system: Phase 2).
export type GeoJsonPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};
