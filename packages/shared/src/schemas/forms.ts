// Zod validation schemas for Phase 0 write paths (plan §7.1 "validation schemas").
// Shared by web forms now and mobile/loader later. Inferred types feed the UI.

import { z } from 'zod';

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v === '' ? undefined : v));

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

export const orgSettingsFormSchema = z.object({
  facility_name: z.string().trim().min(1, 'Facility name is required').max(200),
  address: optionalText,
  locale: z.string().trim().min(2).max(10).default('en-US'),
  distance_unit: z.enum(['mi', 'km']).default('mi'),
  currency: z.string().trim().length(3).default('USD'),
  timezone: z.string().trim().min(1).default('America/New_York'),
});
export type OrgSettingsForm = z.infer<typeof orgSettingsFormSchema>;
