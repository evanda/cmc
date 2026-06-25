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
  PmAdvanceFrom,
  PmIntervalUnit,
  PmTriggerType,
  UserRole,
  WorkOrderPhotoKind,
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

/** Per-church brand colours stored in org_settings.theme (plan §7.6). */
export type OrgTheme = {
  primaryColor?: string;  // hex, e.g. "#1e3a5f"
  accentColor?: string;   // hex, e.g. "#c8a84b"
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
  theme: OrgTheme | null;
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
  geometry_geojson: GeoJsonPoint | null;
  level: number | null;
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
  /**
   * Intrinsic map point for fixed assets (AC units, AEDs, shutoffs) — null until
   * placed. Lets a non-moving asset sit on the map directly, without a shadow POI
   * (plan §5.4, issue #38). Set via loader/seed, not the hand-edited asset form.
   */
  geometry_geojson: GeoJsonPoint | null;
  /** Floor level for the map point: -1=B1, 0/1=ground, 2…; null = unplaced/site. */
  level: number | null;
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
  vendor_id: string | null;
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
  /** The PM schedule that generated this WO, if any (plan §6). */
  source_pm_id: string | null;
};

/** A preventive-maintenance schedule (plan §4.3, §6). */
export type PmSchedule = BaseRow & {
  name: string;
  asset_id: string | null;
  location_id: string | null;
  task_template_id: string | null;
  trigger_type: PmTriggerType;
  interval_value: number | null;
  interval_unit: PmIntervalUnit | null;
  fixed_month: number | null;
  fixed_day: number | null;
  meter_id: string | null;
  meter_threshold: number | null;
  anchor_date: string;
  advance_from: PmAdvanceFrom;
  lead_time_days: number;
  assignee_user_id: string | null;
  vendor_id: string | null;
  is_compliance: boolean;
  category: string | null;
  active: boolean;
};

export type TaskTemplate = BaseRow & {
  name: string;
  instructions: string | null;
  checklist_template_id: string | null;
};

export type Meter = BaseRow & {
  asset_id: string;
  type: string;
  unit: string;
};

export type MeterReading = BaseRow & {
  meter_id: string;
  value: number;
  reading_date: string;
  recorded_by: string | null;
};

/** Vehicle profile extending an asset with registration/fleet fields (plan §4.4). */
export type Vehicle = BaseRow & {
  asset_id: string;
  vin: string | null;
  plate: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  fuel_type: string | null;
  capacity: number | null;
  registration_expiry: string | null;   // YYYY-MM-DD
  insurance_expiry: string | null;      // YYYY-MM-DD
  inspection_expiry: string | null;     // YYYY-MM-DD
  driver_contact_id: string | null;
};

/** External company that performs work (plan §4.5). */
export type Vendor = BaseRow & {
  name: string;
  category: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  rate: number | null;
  coi_expiry: string | null;
  contract_expiry: string | null;
  notes: string | null;
};

/** Recurring service (garbage, pest, landscaping…) (plan §4.5). */
export type ServiceContract = BaseRow & {
  vendor_id: string | null;
  description: string;
  cadence: string | null;
  cost: number | null;
  period_unit: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_reminder_days: number | null;
};

/** Lighter directory entry: utilities, insurance agent, locksmith… (plan §4.5). */
export type Contact = BaseRow & {
  name: string;
  org: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  account_number: string | null;
  notes: string | null;
};

/** A clickable map marker linked to a domain object (plan §5.4). */
export type Poi = BaseRow & {
  building_id: string | null;
  floor_id: string | null;
  level: number | null;
  geometry_geojson: GeoJsonPoint;
  poi_type: string;
  linked_asset_id: string | null;
  label: string | null;
  icon: string | null;
  notes: string | null;
};

/** A photo/attachment on a work order; `kind` = before | after (plan §4.2, §6). */
export type WorkOrderAttachment = BaseRow & {
  work_order_id: string;
  url: string;
  kind: WorkOrderPhotoKind;
  caption: string | null;
  taken_at: string | null;
};

// Minimal GeoJSON shapes used by the spatial schema (full system: Phase 2).
export type GeoJsonPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type GeoJsonPoint = {
  type: 'Point';
  coordinates: number[];
};
