// In-memory demo data source (VITE_DEMO=1). Mirrors the `bigcampus` dev fixture
// so the app renders fully populated for screenshots without any backend.
// Mutations update the in-memory store so create/edit/delete flows also work.

import type {
  Asset,
  AssetCategory,
  AssetForm,
  Building,
  BuildingForm,
  Floor,
  FloorForm,
  Location,
  LocationForm,
  OrgSettings,
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
};

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
    ...fields,
  });
}

seedAsset('RTU-1 Rooftop Unit', 'HVAC', 'Sanctuary', {
  make: 'Carrier',
  model: '48TC',
  serial: 'C1234',
  criticality: 'high',
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

  listAssetCategories: async () =>
    [...categories].sort((a, b) => a.name.localeCompare(b.name)),

  listAssets: async () =>
    (live(assets) as Asset[]).sort((a, b) => a.name.localeCompare(b.name)),
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
    });
    return a;
  },
  deleteAsset: async (aid) => {
    const a = assets.find((x) => x.id === aid);
    if (a) a.deleted_at = now;
  },
};
