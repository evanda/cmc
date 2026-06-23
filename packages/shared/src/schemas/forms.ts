// Zod validation schemas for Phase 0 write paths (plan §7.1 "validation schemas").
// Shared by web forms now and mobile/loader later. Inferred types feed the UI.

import { z } from 'zod';
import { ASSET_STATUSES, CRITICALITIES, WORK_ORDER_TYPES } from '../types/enums.js';

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

export const buildingFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: optionalText,
  address: optionalText,
});
export type BuildingForm = z.infer<typeof buildingFormSchema>;

export const floorFormSchema = z.object({
  building_id: z.string().uuid('Pick a building'),
  name: z.string().trim().min(1, 'Name is required').max(200),
  // Integer level: -1 = B1, 0/1 = ground, 2… (plan §5.2).
  level: z.coerce.number().int('Level must be a whole number').min(-10).max(200),
});
export type FloorForm = z.infer<typeof floorFormSchema>;

export const locationFormSchema = z.object({
  building_id: z.string().uuid('Pick a building'),
  floor_id: z.string().uuid().nullish(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  type: optionalText,
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

export const orgSettingsFormSchema = z.object({
  facility_name: z.string().trim().min(1, 'Facility name is required').max(200),
  address: optionalText,
  locale: z.string().trim().min(2).max(10).default('en-US'),
  distance_unit: z.enum(['mi', 'km']).default('mi'),
  currency: z.string().trim().length(3).default('USD'),
  timezone: z.string().trim().min(1).default('America/New_York'),
});
export type OrgSettingsForm = z.infer<typeof orgSettingsFormSchema>;
