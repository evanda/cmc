// Shared state, primitives, and seed helpers for the demo data source.
// Imported by demo-seed-sample.ts, demo-seed-midway.ts, and demo.ts.

import type {
  Asset,
  AssetCategory,
  AssetPhoto,
  Building,
  Contact,
  Floor,
  Location,
  OrgSettings,
  PmSchedule,
  ServiceContract,
  User,
  Vendor,
  WorkOrder,
  WorkOrderAttachment,
  WorkOrderPhotoKind,
} from '@cmc/shared';

export let seq = 0;
export const id = () => `demo-${++seq}`;
export const now = '2026-06-23T12:00:00.000Z';
export function base() {
  return { created_at: now, updated_at: now, created_by: 'demo-admin', deleted_at: null };
}

export const org: OrgSettings = {
  id: id(),
  ...base(),
  facility_name: 'Sample Campus (demo)',
  logo_url: null,
  address: '500 Campus Drive, Riverton',
  locale: 'en-US',
  distance_unit: 'mi',
  currency: 'USD',
  timezone: 'America/New_York',
  theme: null,
  maintenance_contact_email: 'maintenance@midwaypca.org',
};

export const users: User[] = [
  { id: 'demo-admin', ...base(), name: 'Pat Director', email: 'admin@demo.test', role: 'admin' },
  { id: id(), ...base(), name: 'Sam Tech', email: 'sam@demo.test', role: 'technician' },
  { id: id(), ...base(), name: 'Trustee Lee', email: 'lee@demo.test', role: 'trustee' },
];

export const categories: AssetCategory[] = [
  'HVAC',
  'Roofing',
  'Plumbing',
  'Electrical',
  'Doors/Access',
  'Windows',
  'Lighting',
  'Fixtures',
  'Flooring/Carpet',
  'Paint/Walls',
  'Restrooms',
  'Network/IT',
  'Sound/AV',
  'Grounds/Playground',
  'Vehicles/Fleet',
  'Tools/Equipment',
  'Utility/Infrastructure',
  'Cemetery',
].map((name) => ({ id: id(), ...base(), name, parent_id: null }));

export const buildings: Building[] = [];
export const floors: Floor[] = [];
export const locations: Location[] = [];
export const assets: Asset[] = [];
export const photos: AssetPhoto[] = [];
export const workOrders: WorkOrder[] = [];
export const woPhotos: WorkOrderAttachment[] = [];
export const vendors: Vendor[] = [];
export const serviceContracts: ServiceContract[] = [];
export const contacts: Contact[] = [];
export const pmSchedules: PmSchedule[] = [];

export const catId = (name: string) => categories.find((c) => c.name === name)!.id;
export const locId = (name: string) => locations.find((l) => l.name === name)?.id ?? null;
export const assetByName = (name: string) => assets.find((a) => a.name === name)!;
export const userId = (name: string) => users.find((u) => u.name === name)!.id;
export const vendorId = (name: string) => vendors.find((v) => v.name === name)!.id;

export const live = (rows: { deleted_at: string | null }[]) =>
  rows.filter((r) => r.deleted_at === null);

export const svgPhoto = (label: string, color: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='320'>` +
      `<rect width='100%' height='100%' fill='${color}'/>` +
      `<text x='50%' y='50%' font-family='sans-serif' font-size='26' fill='white' ` +
      `text-anchor='middle' dominant-baseline='middle'>${label}</text></svg>`,
  );

export function seedBuilding(
  name: string,
  description: string | null,
  floorSpecs: { name: string; level: number }[],
  locationSpecs: { name: string; type: string; floor?: string }[],
) {
  const b: Building = {
    id: id(),
    ...base(),
    name,
    description,
    address: null,
    footprint_geojson: null,
  };
  buildings.push(b);
  const floorByName = new Map<string, string>();
  for (const f of floorSpecs) {
    const fl: Floor = {
      id: id(),
      ...base(),
      building_id: b.id,
      name: f.name,
      level: f.level,
      floorplan_image_url: null,
      geo_corners_geojson: null,
      rotation_deg: null,
    };
    floors.push(fl);
    floorByName.set(f.name, fl.id);
  }
  for (const l of locationSpecs) {
    locations.push({
      id: id(),
      ...base(),
      building_id: b.id,
      floor_id: l.floor ? (floorByName.get(l.floor) ?? null) : null,
      name: l.name,
      type: l.type,
    });
  }
}

export function seedAsset(
  name: string,
  category: string,
  location: string | null,
  fields: Partial<Asset> = {},
) {
  assets.push({
    id: id(),
    ...base(),
    name,
    category_id: catId(category),
    parent_asset_id: null,
    location_id: location ? locId(location) : null,
    make: null,
    model: null,
    serial: null,
    install_date: null,
    purchase_cost: null,
    expected_life_years: null,
    replacement_cost: null,
    warranty_expiry: null,
    criticality: 'low',
    status: 'active',
    qr_token: null,
    notes: null,
    contact_name: null,
    contact_email: null,
    ...fields,
  });
}

export function seedPhoto(assetName: string, label: string, color: string, primary = false) {
  photos.push({
    id: id(),
    ...base(),
    asset_id: assetByName(assetName).id,
    url: svgPhoto(label, color),
    caption: label,
    is_primary: primary,
    taken_at: now,
  });
}

export function buildWO(partial: Partial<WorkOrder> & { title: string }): WorkOrder {
  return {
    id: id(),
    ...base(),
    description: null,
    type: 'reactive',
    priority: 'medium',
    status: 'open',
    linked_asset_id: null,
    location_id: null,
    requested_by: null,
    assignee_user_id: null,
    coordinated_by_user_id: null,
    authorized_by_user_id: null,
    vendor_name: null,
    vendor_id: null,
    estimate_cost: null,
    actual_parts_cost: null,
    actual_labor_cost: null,
    actual_vendor_cost: null,
    labor_hours: null,
    invoice_number: null,
    invoice_url: null,
    payment_reference: null,
    scheduled_date: null,
    due_date: null,
    completed_date: null,
    completion_notes: null,
    source_pm_id: null,
    ...partial,
  };
}

export function seedWO(
  assetName: string,
  wo: Partial<WorkOrder> & { title: string },
): WorkOrder {
  const w = buildWO({ status: 'completed', linked_asset_id: assetByName(assetName).id, ...wo });
  workOrders.push(w);
  return w;
}

export function seedWOPhoto(
  wo: WorkOrder,
  kind: WorkOrderPhotoKind,
  label: string,
  color: string,
) {
  woPhotos.push({
    id: id(),
    ...base(),
    work_order_id: wo.id,
    url: svgPhoto(label, color),
    kind,
    caption: label,
    taken_at: now,
  });
}

export function seedRequest(partial: Partial<WorkOrder> & { title: string }) {
  workOrders.push(
    buildWO({ status: 'requested', requested_by: userId('Trustee Lee'), ...partial }),
  );
}

export function seedPm(partial: Partial<PmSchedule> & { name: string }) {
  pmSchedules.push({
    id: id(),
    ...base(),
    asset_id: null,
    location_id: null,
    task_template_id: null,
    trigger_type: 'calendar',
    interval_value: null,
    interval_unit: null,
    fixed_month: null,
    fixed_day: null,
    meter_id: null,
    meter_threshold: null,
    anchor_date: '2026-04-01',
    advance_from: 'completion',
    lead_time_days: 14,
    assignee_user_id: null,
    vendor_id: null,
    is_compliance: false,
    category: null,
    active: true,
    ...partial,
  });
}
