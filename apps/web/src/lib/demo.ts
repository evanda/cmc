// In-memory demo data source (VITE_DEMO=1). Mirrors the `bigcampus` dev fixture
// so the app renders fully populated for screenshots without any backend.
// Mutations update the in-memory store so create/edit/delete flows also work.

import type {
  Asset,
  AssetCategory,
  AssetForm,
  AssetPhoto,
  Building,
  BuildingForm,
  Floor,
  FloorForm,
  Location,
  LocationForm,
  OrgSettings,
  User,
  WorkLogForm,
  WorkOrder,
} from '@cmc/shared';
import type { DataSource } from './datasource';

let seq = 0;
const id = () => `demo-${++seq}`;
const now = '2026-06-23T12:00:00.000Z';
function base() {
  return { created_at: now, updated_at: now, created_by: 'demo-admin', deleted_at: null };
}

const org: OrgSettings = {
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

// Demo users for assignee / coordinator / authorizer pickers.
const users: User[] = [
  { id: 'demo-admin', ...base(), name: 'Pat Director', email: 'admin@demo.test', role: 'admin' },
  { id: id(), ...base(), name: 'Sam Tech', email: 'sam@demo.test', role: 'technician' },
  { id: id(), ...base(), name: 'Trustee Lee', email: 'lee@demo.test', role: 'trustee' },
];
const userId = (name: string) => users.find((u) => u.name === name)!.id;

const buildings: Building[] = [];
const floors: Floor[] = [];
const locations: Location[] = [];

function seedBuilding(
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

seedBuilding(
  'Main Church',
  'Sanctuary, narthex, offices, basement fellowship hall.',
  [
    { name: 'Basement', level: -1 },
    { name: 'Ground', level: 1 },
    { name: 'Balcony', level: 2 },
  ],
  [
    { name: 'Sanctuary', type: 'area', floor: 'Ground' },
    { name: 'Narthex', type: 'area', floor: 'Ground' },
    { name: 'Church Office', type: 'room', floor: 'Ground' },
    { name: 'Fellowship Hall', type: 'area', floor: 'Basement' },
    { name: 'Boiler Room', type: 'room', floor: 'Basement' },
    { name: 'Choir Loft', type: 'area', floor: 'Balcony' },
  ],
);
seedBuilding(
  'School',
  'Two-story classroom building with gymnasium.',
  [
    { name: 'First Floor', level: 1 },
    { name: 'Second Floor', level: 2 },
  ],
  [
    { name: 'Room 101', type: 'room', floor: 'First Floor' },
    { name: 'Room 102', type: 'room', floor: 'First Floor' },
    { name: 'Cafeteria', type: 'area', floor: 'First Floor' },
    { name: 'Room 201', type: 'room', floor: 'Second Floor' },
    { name: 'Science Lab', type: 'room', floor: 'Second Floor' },
  ],
);
seedBuilding(
  'Gymnasium',
  null,
  [{ name: 'Court Level', level: 1 }],
  [
    { name: 'Main Court', type: 'area', floor: 'Court Level' },
    { name: 'Locker Room A', type: 'room', floor: 'Court Level' },
    { name: 'Equipment Storage', type: 'room', floor: 'Court Level' },
  ],
);
seedBuilding(
  'Grounds',
  'Outdoor areas: playground, cemetery, parking.',
  [],
  [
    { name: 'Playground', type: 'area' },
    { name: 'Cemetery', type: 'area' },
    { name: 'North Parking Lot', type: 'area' },
  ],
);

// Default asset categories (mirrors the 0003 seed migration, plan §4.1).
const categories: AssetCategory[] = [
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

const catId = (name: string) => categories.find((c) => c.name === name)!.id;
const locId = (name: string) => locations.find((l) => l.name === name)?.id ?? null;

const assets: Asset[] = [];
function seedAsset(name: string, category: string, location: string | null, fields: Partial<Asset> = {}) {
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

seedAsset('RTU-1 Rooftop Unit', 'HVAC', 'Sanctuary', {
  make: 'Carrier',
  model: '48TC',
  serial: 'C1234',
  criticality: 'high',
  contact_name: 'HVAC Systems Lead',
  contact_email: 'hvac@midwaypca.org',
});
seedAsset('Main Water Shutoff', 'Utility/Infrastructure', 'Boiler Room', { criticality: 'high' });
seedAsset('Boiler', 'HVAC', 'Boiler Room', { make: 'Weil-McLain', criticality: 'high' });
seedAsset('Sanctuary Sound Board', 'Sound/AV', 'Sanctuary', { make: 'Yamaha', model: 'TF5' });
seedAsset('Network Rack', 'Network/IT', 'Church Office', { criticality: 'medium' });
seedAsset('Gym Scoreboard', 'Sound/AV', 'Main Court', {});
seedAsset('Leaf Blower', 'Tools/Equipment', null, { make: 'Stihl', model: 'BR700' });
seedAsset('Extension Ladder (24ft)', 'Tools/Equipment', null, {});
seedAsset('Playground Structure', 'Grounds/Playground', 'Playground', { criticality: 'medium' });
seedAsset('Walk-in Cooler', 'Fixtures', 'Cafeteria', { status: 'retired' });

// Simple labeled-rectangle SVG "photos" so the demo gallery shows something.
const svgPhoto = (label: string, color: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='320'>` +
      `<rect width='100%' height='100%' fill='${color}'/>` +
      `<text x='50%' y='50%' font-family='sans-serif' font-size='26' fill='white' ` +
      `text-anchor='middle' dominant-baseline='middle'>${label}</text></svg>`,
  );

const assetByName = (name: string) => assets.find((a) => a.name === name)!;

const photos: AssetPhoto[] = [];
function seedPhoto(assetName: string, label: string, color: string, primary = false) {
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
seedPhoto('RTU-1 Rooftop Unit', 'RTU-1 — nameplate', '#0f766e', true);
seedPhoto('RTU-1 Rooftop Unit', 'RTU-1 — install', '#334155');
seedPhoto('Playground Structure', 'Playground — overview', '#9333ea', true);

const workOrders: WorkOrder[] = [];
function seedWO(assetName: string, wo: Partial<WorkOrder> & { title: string }) {
  workOrders.push({
    id: id(),
    ...base(),
    description: null,
    type: 'reactive',
    priority: 'medium',
    status: 'completed',
    linked_asset_id: assetByName(assetName).id,
    location_id: null,
    requested_by: null,
    assignee_user_id: null,
    coordinated_by_user_id: null,
    authorized_by_user_id: null,
    vendor_name: null,
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
    ...wo,
  });
}
seedWO('RTU-1 Rooftop Unit', {
  title: 'Annual HVAC service + filter',
  type: 'preventive',
  completed_date: '2026-04-12',
  vendor_name: 'Acme Mechanical',
  coordinated_by_user_id: userId('Sam Tech'),
  authorized_by_user_id: userId('Pat Director'),
  actual_vendor_cost: 480,
  actual_parts_cost: 65,
  labor_hours: 2.5,
  invoice_number: 'ACM-10482',
  payment_reference: 'Check #2041',
  completion_notes: 'Replaced filters, checked refrigerant charge, cleaned coils.',
});
seedWO('RTU-1 Rooftop Unit', {
  title: 'Compressor capacitor replacement',
  completed_date: '2026-02-03',
  vendor_name: 'Acme Mechanical',
  coordinated_by_user_id: userId('Sam Tech'),
  authorized_by_user_id: userId('Pat Director'),
  actual_vendor_cost: 220,
  actual_parts_cost: 38,
  invoice_number: 'ACM-10110',
  payment_reference: 'Check #1998',
  completion_notes: 'No-cool call; capacitor failed. Replaced and verified operation.',
});
seedWO('Boiler', {
  title: 'Boiler inspection & low-water cutoff test',
  type: 'inspection',
  completed_date: '2026-03-20',
  assignee_user_id: userId('Sam Tech'),
  authorized_by_user_id: userId('Pat Director'),
  actual_labor_cost: 0,
  labor_hours: 1,
  completion_notes: 'Passed. Next test due in 6 months.',
});
seedWO('Playground Structure', {
  title: 'Replace cracked slide bolt set',
  completed_date: '2026-05-09',
  assignee_user_id: userId('Sam Tech'),
  actual_parts_cost: 24.5,
  labor_hours: 0.75,
  payment_reference: 'Card ****1234',
});

const live = (rows: { deleted_at: string | null }[]) => rows.filter((r) => r.deleted_at === null);

export const demoDataSource: DataSource = {
  getOrgSettings: async () => org,

  listBuildings: async () =>
    (live(buildings) as Building[]).sort((a, b) => a.name.localeCompare(b.name)),
  createBuilding: async (input: BuildingForm) => {
    const b: Building = {
      id: id(),
      ...base(),
      name: input.name,
      description: input.description ?? null,
      address: input.address ?? null,
      footprint_geojson: null,
    };
    buildings.push(b);
    return b;
  },
  updateBuilding: async (bid, input: BuildingForm) => {
    const b = buildings.find((x) => x.id === bid)!;
    Object.assign(b, {
      name: input.name,
      description: input.description ?? null,
      address: input.address ?? null,
    });
    return b;
  },
  deleteBuilding: async (bid) => {
    const b = buildings.find((x) => x.id === bid);
    if (b) b.deleted_at = now;
  },

  listFloors: async (buildingId) =>
    (live(floors) as Floor[])
      .filter((f) => !buildingId || f.building_id === buildingId)
      .sort((a, b) => a.level - b.level),
  createFloor: async (input: FloorForm) => {
    const f: Floor = {
      id: id(),
      ...base(),
      building_id: input.building_id,
      name: input.name,
      level: input.level,
      floorplan_image_url: null,
      geo_corners_geojson: null,
      rotation_deg: null,
    };
    floors.push(f);
    return f;
  },
  updateFloor: async (fid, input: FloorForm) => {
    const f = floors.find((x) => x.id === fid)!;
    Object.assign(f, { building_id: input.building_id, name: input.name, level: input.level });
    return f;
  },
  deleteFloor: async (fid) => {
    const f = floors.find((x) => x.id === fid);
    if (f) f.deleted_at = now;
  },

  listLocations: async (buildingId) =>
    (live(locations) as Location[])
      .filter((l) => !buildingId || l.building_id === buildingId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  createLocation: async (input: LocationForm) => {
    const l: Location = {
      id: id(),
      ...base(),
      building_id: input.building_id,
      floor_id: input.floor_id ?? null,
      name: input.name,
      type: input.type ?? null,
    };
    locations.push(l);
    return l;
  },
  updateLocation: async (lid, input: LocationForm) => {
    const l = locations.find((x) => x.id === lid)!;
    Object.assign(l, {
      building_id: input.building_id,
      floor_id: input.floor_id ?? null,
      name: input.name,
      type: input.type ?? null,
    });
    return l;
  },
  deleteLocation: async (lid) => {
    const l = locations.find((x) => x.id === lid);
    if (l) l.deleted_at = now;
  },

  listUsers: async () => [...users].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),

  listAssetCategories: async () =>
    [...categories].sort((a, b) => a.name.localeCompare(b.name)),

  listAssets: async () =>
    (live(assets) as Asset[]).sort((a, b) => a.name.localeCompare(b.name)),
  getAsset: async (aid) => assets.find((a) => a.id === aid && a.deleted_at === null) ?? null,
  createAsset: async (input: AssetForm) => {
    const a: Asset = {
      id: id(),
      ...base(),
      name: input.name,
      category_id: input.category_id ?? null,
      parent_asset_id: null,
      location_id: input.location_id ?? null,
      make: input.make ?? null,
      model: input.model ?? null,
      serial: input.serial ?? null,
      install_date: null,
      purchase_cost: null,
      expected_life_years: null,
      replacement_cost: null,
      warranty_expiry: null,
      criticality: input.criticality,
      status: input.status,
      qr_token: null,
      notes: input.notes ?? null,
      contact_name: input.contact_name ?? null,
      contact_email: input.contact_email ?? null,
    };
    assets.push(a);
    return a;
  },
  updateAsset: async (aid, input: AssetForm) => {
    const a = assets.find((x) => x.id === aid)!;
    Object.assign(a, {
      name: input.name,
      category_id: input.category_id ?? null,
      location_id: input.location_id ?? null,
      make: input.make ?? null,
      model: input.model ?? null,
      serial: input.serial ?? null,
      criticality: input.criticality,
      status: input.status,
      notes: input.notes ?? null,
      contact_name: input.contact_name ?? null,
      contact_email: input.contact_email ?? null,
    });
    return a;
  },
  deleteAsset: async (aid) => {
    const a = assets.find((x) => x.id === aid);
    if (a) a.deleted_at = now;
  },

  listAssetPhotos: async (assetId) =>
    (live(photos) as AssetPhoto[])
      .filter((p) => p.asset_id === assetId)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
  addAssetPhoto: async (assetId, file) => {
    const url = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    const first = !photos.some((p) => p.asset_id === assetId && p.deleted_at === null);
    const p: AssetPhoto = {
      id: id(),
      ...base(),
      asset_id: assetId,
      url,
      caption: file.name,
      is_primary: first,
      taken_at: now,
    };
    photos.push(p);
    return p;
  },
  setPrimaryPhoto: async (assetId, photoId) => {
    for (const p of photos) if (p.asset_id === assetId) p.is_primary = p.id === photoId;
  },
  deleteAssetPhoto: async (photoId) => {
    const p = photos.find((x) => x.id === photoId);
    if (p) p.deleted_at = now;
  },

  listWorkOrders: async (assetId) =>
    (live(workOrders) as WorkOrder[])
      .filter((w) => w.linked_asset_id === assetId)
      .sort((a, b) => (b.completed_date ?? '').localeCompare(a.completed_date ?? '')),
  createWorkOrder: async (assetId, input: WorkLogForm) => {
    const w: WorkOrder = {
      id: id(),
      ...base(),
      title: input.title,
      description: null,
      type: input.type,
      priority: 'medium',
      status: 'completed',
      linked_asset_id: assetId,
      location_id: null,
      requested_by: null,
      assignee_user_id: input.assignee_user_id ?? null,
      coordinated_by_user_id: input.coordinated_by_user_id ?? null,
      authorized_by_user_id: input.authorized_by_user_id ?? null,
      vendor_name: input.vendor_name ?? null,
      estimate_cost: null,
      actual_parts_cost: input.actual_parts_cost ?? null,
      actual_labor_cost: input.actual_labor_cost ?? null,
      actual_vendor_cost: input.actual_vendor_cost ?? null,
      labor_hours: input.labor_hours ?? null,
      invoice_number: input.invoice_number ?? null,
      invoice_url: null,
      payment_reference: input.payment_reference ?? null,
      scheduled_date: null,
      due_date: null,
      completed_date: input.completed_date ?? null,
      completion_notes: input.completion_notes ?? null,
    };
    workOrders.push(w);
    return w;
  },
};
