import { describe, expect, it } from 'vitest';
import {
  assetFormSchema,
  buildingFormSchema,
  contactFormSchema,
  floorFormSchema,
  orgSettingsFormSchema,
  pmScheduleFormSchema,
  vendorFormSchema,
  vehicleFormSchema,
  workOrderFormSchema,
  workRequestFormSchema,
} from './forms.js';

// ── optionalEmail helper (shared by asset, vendor, contact, orgSettings) ──────

describe('optionalEmail (shared helper)', () => {
  it('accepts a valid email address', () => {
    const r = vendorFormSchema.safeParse({ name: 'ACME', email: 'hi@example.com' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('hi@example.com');
  });

  it('coerces empty string to undefined', () => {
    const r = vendorFormSchema.safeParse({ name: 'ACME', email: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBeUndefined();
  });

  it('rejects an invalid email format', () => {
    const r = vendorFormSchema.safeParse({ name: 'ACME', email: 'not-an-email' });
    expect(r.success).toBe(false);
  });

  it('accepts undefined (field omitted)', () => {
    const r = vendorFormSchema.safeParse({ name: 'ACME' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBeUndefined();
  });
});

// ── optionalNumber helper (shared by many cost / measurement fields) ──────────

describe('optionalNumber (shared helper)', () => {
  it('coerces empty string to undefined', () => {
    const r = vendorFormSchema.safeParse({ name: 'ACME', rate: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rate).toBeUndefined();
  });

  it('accepts zero (non-negative boundary)', () => {
    const r = vendorFormSchema.safeParse({ name: 'ACME', rate: 0 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rate).toBe(0);
  });

  it('coerces a numeric string to a number', () => {
    const r = vendorFormSchema.safeParse({ name: 'ACME', rate: '125.50' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rate).toBe(125.5);
  });

  it('rejects negative values', () => {
    const r = vendorFormSchema.safeParse({ name: 'ACME', rate: -1 });
    expect(r.success).toBe(false);
  });

  it('coerces null to undefined', () => {
    const r = vendorFormSchema.safeParse({ name: 'ACME', rate: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rate).toBeUndefined();
  });
});

// ── optionalText helper (trims + coerces '' → undefined) ─────────────────────

describe('optionalText (shared helper)', () => {
  it('trims whitespace from strings', () => {
    const r = buildingFormSchema.safeParse({ name: 'HQ', address: '  123 Main St  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.address).toBe('123 Main St');
  });

  it('coerces blank string to undefined', () => {
    const r = buildingFormSchema.safeParse({ name: 'HQ', address: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.address).toBeUndefined();
  });

  it('rejects strings over 2000 characters', () => {
    const r = buildingFormSchema.safeParse({ name: 'HQ', description: 'x'.repeat(2001) });
    expect(r.success).toBe(false);
  });
});

// ── buildingFormSchema ────────────────────────────────────────────────────────

describe('buildingFormSchema', () => {
  it('accepts a minimal valid building (name only)', () => {
    const r = buildingFormSchema.safeParse({ name: 'Sanctuary' });
    expect(r.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const r = buildingFormSchema.safeParse({ name: '' });
    expect(r.success).toBe(false);
  });

  it('accepts GeoJSON footprint as a passthrough value', () => {
    const geo = { type: 'Polygon', coordinates: [[[0, 0]]] };
    const r = buildingFormSchema.safeParse({ name: 'Sanctuary', footprint_geojson: geo });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.footprint_geojson).toEqual(geo);
  });
});

// ── floorFormSchema ───────────────────────────────────────────────────────────

describe('floorFormSchema', () => {
  const base = { building_id: '00000000-0000-0000-0000-000000000001', name: 'Ground' };

  it('accepts a valid floor at level 1', () => {
    const r = floorFormSchema.safeParse({ ...base, level: 1 });
    expect(r.success).toBe(true);
  });

  it('accepts basement level (-1)', () => {
    const r = floorFormSchema.safeParse({ ...base, level: -1 });
    expect(r.success).toBe(true);
  });

  it('rejects a non-integer level (float)', () => {
    const r = floorFormSchema.safeParse({ ...base, level: 1.5 });
    expect(r.success).toBe(false);
  });

  it('rejects an invalid UUID for building_id', () => {
    const r = floorFormSchema.safeParse({ ...base, building_id: 'not-a-uuid' });
    expect(r.success).toBe(false);
  });
});

// ── assetFormSchema ───────────────────────────────────────────────────────────

describe('assetFormSchema', () => {
  const base = { name: 'Boiler', criticality: 'high' as const, status: 'active' as const };

  it('accepts a minimal asset', () => {
    const r = assetFormSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('validates contact_email via the shared optionalEmail helper', () => {
    const bad = assetFormSchema.safeParse({ ...base, contact_email: 'bad' });
    expect(bad.success).toBe(false);
    const good = assetFormSchema.safeParse({ ...base, contact_email: 'tech@example.com' });
    expect(good.success).toBe(true);
  });
});

// ── workRequestFormSchema (intake) ────────────────────────────────────────────

describe('workRequestFormSchema', () => {
  it('accepts a title-only request', () => {
    const r = workRequestFormSchema.safeParse({ title: 'AC out in Room 12' });
    expect(r.success).toBe(true);
  });

  it('rejects a missing title', () => {
    const r = workRequestFormSchema.safeParse({ title: '' });
    expect(r.success).toBe(false);
  });
});

// ── workOrderFormSchema ───────────────────────────────────────────────────────

describe('workOrderFormSchema', () => {
  it('defaults type to reactive, priority to medium, status to open', () => {
    const r = workOrderFormSchema.safeParse({ title: 'Fix roof' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.type).toBe('reactive');
      expect(r.data.priority).toBe('medium');
      expect(r.data.status).toBe('open');
    }
  });

  it('rejects an invalid status value', () => {
    const r = workOrderFormSchema.safeParse({ title: 'x', status: 'done' });
    expect(r.success).toBe(false);
  });

  it('coerces empty due_date string to undefined', () => {
    const r = workOrderFormSchema.safeParse({ title: 'x', due_date: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.due_date).toBeUndefined();
  });
});

// ── pmScheduleFormSchema ──────────────────────────────────────────────────────

describe('pmScheduleFormSchema', () => {
  const base = {
    name: 'HVAC filter swap',
    trigger_type: 'calendar' as const,
    anchor_date: '2026-01-01',
  };

  it('accepts a minimal calendar PM', () => {
    const r = pmScheduleFormSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('defaults lead_time_days to 14', () => {
    const r = pmScheduleFormSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.lead_time_days).toBe(14);
  });

  it('rejects an anchor_date of empty string', () => {
    const r = pmScheduleFormSchema.safeParse({ ...base, anchor_date: '' });
    expect(r.success).toBe(false);
  });

  it('rejects a lead_time_days above 365', () => {
    const r = pmScheduleFormSchema.safeParse({ ...base, lead_time_days: 366 });
    expect(r.success).toBe(false);
  });
});

// ── vehicleFormSchema ─────────────────────────────────────────────────────────

describe('vehicleFormSchema', () => {
  const assetUUID = '00000000-0000-0000-0000-000000000001';

  it('accepts a minimal vehicle (asset_id only)', () => {
    const r = vehicleFormSchema.safeParse({ asset_id: assetUUID });
    expect(r.success).toBe(true);
  });

  it('rejects an invalid asset_id UUID', () => {
    const r = vehicleFormSchema.safeParse({ asset_id: 'not-a-uuid' });
    expect(r.success).toBe(false);
  });

  it('rejects a year before 1900', () => {
    const r = vehicleFormSchema.safeParse({ asset_id: assetUUID, year: 1800 });
    expect(r.success).toBe(false);
  });
});

// ── contactFormSchema ─────────────────────────────────────────────────────────

describe('contactFormSchema', () => {
  it('accepts a minimal contact (name only)', () => {
    const r = contactFormSchema.safeParse({ name: 'Water Dept' });
    expect(r.success).toBe(true);
  });

  it('validates email', () => {
    const r = contactFormSchema.safeParse({ name: 'Water Dept', email: 'bad-email' });
    expect(r.success).toBe(false);
  });
});

// ── orgSettingsFormSchema ─────────────────────────────────────────────────────

describe('orgSettingsFormSchema', () => {
  const base = { facility_name: 'Midway PCA' };

  it('accepts minimal settings', () => {
    const r = orgSettingsFormSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('rejects an invalid logo URL', () => {
    const r = orgSettingsFormSchema.safeParse({ ...base, logo_url: 'not-a-url' });
    expect(r.success).toBe(false);
  });

  it('rejects a malformed hex primary colour', () => {
    const r = orgSettingsFormSchema.safeParse({
      ...base,
      theme: { primaryColor: '1e3a5f' }, // missing '#'
    });
    expect(r.success).toBe(false);
  });

  it('accepts a valid 6-digit hex colour', () => {
    const r = orgSettingsFormSchema.safeParse({
      ...base,
      theme: { primaryColor: '#1e3a5f', accentColor: '#c0ffee' },
    });
    expect(r.success).toBe(true);
  });

  it('defaults locale to en-US and distance_unit to mi', () => {
    const r = orgSettingsFormSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.locale).toBe('en-US');
      expect(r.data.distance_unit).toBe('mi');
    }
  });
});
