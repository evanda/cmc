// Zod validation schemas for Phase 0 write paths (plan §7.1 "validation schemas").
// Shared by web forms now and mobile/loader later. Inferred types feed the UI.

import { z } from 'zod';
import {
  ASSET_STATUSES,
  CRITICALITIES,
  PM_INTERVAL_UNITS,
  PM_TRIGGER_TYPES,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
} from '../types/enums.js';

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v === '' ? undefined : v));

/** Optional email: accepts '' (→ undefined) or a valid address. */
const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' ? undefined : v))
  .refine((v) => v === undefined || z.string().email().safeParse(v).success, 'Invalid email');

/** Optional non-negative money/number from a text input ('' → undefined). */
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().nonnegative('Must be ≥ 0').optional(),
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const optionalGeoJson = z.any().nullable().optional();

export const buildingFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: optionalText,
  address: optionalText,
  footprint_geojson: optionalGeoJson,
});
export type BuildingForm = z.infer<typeof buildingFormSchema>;

export const floorFormSchema = z.object({
  building_id: z.string().uuid('Pick a building'),
  name: z.string().trim().min(1, 'Name is required').max(200),
  // Integer level: -1 = B1, 0/1 = ground, 2… (plan §5.2).
  level: z.coerce.number().int('Level must be a whole number').min(-10).max(200),
  floorplan_image_url: optionalText,
  boundary_geojson: optionalGeoJson,
  geo_corners_geojson: optionalGeoJson,
});
export type FloorForm = z.infer<typeof floorFormSchema>;

export const locationFormSchema = z.object({
  building_id: z.string().uuid('Pick a building'),
  floor_id: z.string().uuid().nullish(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  type: optionalText,
  geometry_geojson: optionalGeoJson,
  map_level: z.coerce.number().int().min(-10).max(200).nullable().optional(),
});
export type LocationForm = z.infer<typeof locationFormSchema>;

// ── Asset Registry (plan §4.1, Phase 1) ──────────────────────────────────────
export const assetFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  category_id: z.string().uuid().nullish(),
  location_id: z.string().uuid().nullish(),
  make: optionalText,
  model: optionalText,
  serial: optionalText,
  criticality: z.enum(CRITICALITIES),
  status: z.enum(ASSET_STATUSES),
  notes: optionalText,
  contact_name: optionalText,
  contact_email: optionalEmail,
  geometry_geojson: optionalGeoJson,
  map_level: z.coerce.number().int().min(-10).max(200).nullable().optional(),
});
export type AssetForm = z.infer<typeof assetFormSchema>;

// ── Log work / service-history entry (plan §4.2, §4.7) ───────────────────────
// Captures a completed unit of work against an asset: what/when/cost, who did
// it, who coordinated/authorized, invoice, and check/payment #.
export const workLogFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  type: z.enum(WORK_ORDER_TYPES).default('reactive'),
  completed_date: z
    .string()
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  assignee_user_id: z.string().uuid().nullish(),
  coordinated_by_user_id: z.string().uuid().nullish(),
  authorized_by_user_id: z.string().uuid().nullish(),
  vendor_id: z.string().uuid().nullish(),
  vendor_name: optionalText,
  actual_parts_cost: optionalNumber,
  actual_labor_cost: optionalNumber,
  actual_vendor_cost: optionalNumber,
  labor_hours: optionalNumber,
  invoice_number: optionalText,
  payment_reference: optionalText,
  completion_notes: optionalText,
});
export type WorkLogForm = z.infer<typeof workLogFormSchema>;

// ── Work Request intake (plan §3.1) ──────────────────────────────────────────
export const workRequestFormSchema = z.object({
  title: z.string().trim().min(1, 'Describe the problem').max(200),
  description: optionalText,
  linked_asset_id: z.string().uuid().nullish(),
  location_id: z.string().uuid().nullish(),
});
export type WorkRequestForm = z.infer<typeof workRequestFormSchema>;

// ── Work Order create (board) — an open, assignable unit of work (plan §4.2) ──
export const workOrderFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: optionalText,
  type: z.enum(WORK_ORDER_TYPES).default('reactive'),
  priority: z.enum(WORK_ORDER_PRIORITIES).default('medium'),
  status: z.enum(WORK_ORDER_STATUSES).default('open'),
  linked_asset_id: z.string().uuid().nullish(),
  location_id: z.string().uuid().nullish(),
  assignee_user_id: z.string().uuid().nullish(),
  vendor_id: z.string().uuid().nullish(),
  due_date: z
    .string()
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
});
export type WorkOrderForm = z.infer<typeof workOrderFormSchema>;

// ── Work Order triage edit — status / assignee / priority (plan §4.2) ────────
export const workOrderUpdateSchema = z.object({
  status: z.enum(WORK_ORDER_STATUSES),
  priority: z.enum(WORK_ORDER_PRIORITIES),
  assignee_user_id: z.string().uuid().nullish(),
  location_id: z.string().uuid().nullish(),
  vendor_id: z.string().uuid().nullish(),
  completion_notes: optionalText,
  labor_hours: optionalNumber,
  actual_parts_cost: optionalNumber,
  actual_labor_cost: optionalNumber,
  actual_vendor_cost: optionalNumber,
});
export type WorkOrderUpdate = z.infer<typeof workOrderUpdateSchema>;

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v === '' ? undefined : v));

// ── Vendors, Service Contracts & Contacts (plan §4.5) ────────────────────────
export const vendorFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  category: optionalText,
  contact_name: optionalText,
  phone: optionalText,
  email: optionalEmail,
  address: optionalText,
  rate: optionalNumber,
  coi_expiry: optionalDate,
  contract_expiry: optionalDate,
  notes: optionalText,
});
export type VendorForm = z.infer<typeof vendorFormSchema>;

export const serviceContractFormSchema = z.object({
  vendor_id: z.string().uuid().nullish(),
  description: z.string().trim().min(1, 'Description is required').max(200),
  cadence: optionalText,
  cost: optionalNumber,
  period_unit: optionalText,
  start_date: optionalDate,
  end_date: optionalDate,
  renewal_reminder_days: optionalNumber,
});
export type ServiceContractForm = z.infer<typeof serviceContractFormSchema>;

export const contactFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  org: optionalText,
  role: optionalText,
  phone: optionalText,
  email: optionalEmail,
  account_number: optionalText,
  notes: optionalText,
});
export type ContactForm = z.infer<typeof contactFormSchema>;

// ── Preventive-Maintenance schedule (plan §4.3) ──────────────────────────────
export const pmScheduleFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  asset_id: z.string().uuid().nullish(),
  trigger_type: z.enum(PM_TRIGGER_TYPES).default('calendar'),
  interval_value: optionalNumber,
  interval_unit: z.enum(PM_INTERVAL_UNITS).nullish(),
  fixed_month: optionalNumber,
  fixed_day: optionalNumber,
  meter_threshold: optionalNumber,
  anchor_date: z.string().min(1, 'Anchor date is required'),
  lead_time_days: z.coerce.number().int().min(0).max(365).default(14),
  assignee_user_id: z.string().uuid().nullish(),
  is_compliance: z.coerce.boolean().default(false),
  category: optionalText,
});
export type PmScheduleForm = z.infer<typeof pmScheduleFormSchema>;

// ── Fleet / Vehicles (plan §4.4, Phase 3) ────────────────────────────────────
export const vehicleFormSchema = z.object({
  asset_id: z.string().uuid('Pick an asset'),
  vin: optionalText,
  plate: optionalText,
  year: z.coerce.number().int().min(1900).max(2200).optional().nullable(),
  make: optionalText,
  model: optionalText,
  fuel_type: optionalText,
  capacity: z.coerce.number().int().min(1).max(999).optional().nullable(),
  registration_expiry: optionalText,
  insurance_expiry: optionalText,
  inspection_expiry: optionalText,
  driver_contact_id: z.string().uuid().optional().nullable(),
});
export type VehicleForm = z.infer<typeof vehicleFormSchema>;

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex colour, e.g. #1e3a5f')
  .optional();

export const orgSettingsFormSchema = z.object({
  facility_name: z.string().trim().min(1, 'Facility name is required').max(200),
  logo_url: z.string().trim().url('Must be a valid URL').nullish(),
  address: optionalText,
  maintenance_contact_email: optionalEmail,
  locale: z.string().trim().min(2).max(10).default('en-US'),
  distance_unit: z.enum(['mi', 'km']).default('mi'),
  currency: z.string().trim().length(3).default('USD'),
  timezone: z.string().trim().min(1).default('America/New_York'),
  theme: z
    .object({
      primaryColor: hexColor,
      accentColor: hexColor,
    })
    .nullish(),
});
export type OrgSettingsForm = z.infer<typeof orgSettingsFormSchema>;
