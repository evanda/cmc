// Midway PCA campus reseed — replaces the sample campus with real map-data.
// Applied when VITE_DEMO=midway. Called after seedSampleCampus() in demo.ts.

import type { Asset, Building, Floor, Location, WorkOrder } from '@cmc/shared';
import midwayData from '../data/midwaypca.json';
import {
  assets,
  base,
  buildings,
  buildWO,
  categories,
  floors,
  id,
  locations,
  org,
  photos,
  seedAsset,
  woPhotos,
  workOrders,
} from './demo-store';

export function applyMidwayReseed() {
  Object.assign(org, {
    facility_name: midwayData.org.facility_name,
    address: midwayData.org.address,
    maintenance_contact_email: midwayData.org.maintenance_contact_email,
    timezone: midwayData.org.timezone,
  });

  for (const arr of [buildings, floors, locations, assets, photos, workOrders, woPhotos])
    (arr as { length: number }).length = 0;

  const buildingIdByName = new Map<string, string>();
  for (const b of midwayData.buildings) {
    const row: Building = {
      id: id(),
      ...base(),
      name: b.name,
      description: b.description,
      address: null,
      footprint_geojson: b.footprint as Building['footprint_geojson'],
    };
    buildings.push(row);
    buildingIdByName.set(b.name, row.id);
  }

  for (const fl of midwayData.floors) {
    const buildingId = buildingIdByName.get(fl.building);
    if (!buildingId) continue;
    floors.push({
      id: id(),
      ...base(),
      building_id: buildingId,
      name: fl.name,
      level: fl.level,
      floorplan_image_url: null,
      geo_corners_geojson: fl.geo_corners as Floor['geo_corners_geojson'],
      rotation_deg: null,
    });
  }

  const locationIdByBuilding = new Map<string, string>();
  for (const l of midwayData.locations) {
    const buildingId = buildingIdByName.get(l.building);
    if (!buildingId) continue;
    const row: Location = {
      id: id(),
      ...base(),
      building_id: buildingId,
      floor_id: null,
      name: l.name,
      type: 'area',
    };
    locations.push(row);
    locationIdByBuilding.set(l.building, row.id);
  }

  const categoryIdByName = (name: string) => categories.find((c) => c.name === name)?.id ?? null;

  // Install year by building so the capital forecast shows the real mixed-age
  // spread of equipment (the church's "units are different ages" concern).
  const installYearByBuilding: Record<string, number> = {
    '2009 Building (Church)': 2009,
    'Fellowship Hall': 2005,
    '1987 Building (School)': 1994,
    'Gym / Middle School': 1998,
  };
  let hvacSeq = 0;
  for (const a of midwayData.assets) {
    const isHvac = a.category === 'HVAC';
    const baseYear = (a.building && installYearByBuilding[a.building]) || 2006;
    // Stagger a few years within a building so replacements don't all land at once.
    const installYear = baseYear + (hvacSeq++ % 4);
    seedAsset(a.name, a.category, null, {
      location_id: (a.building ? locationIdByBuilding.get(a.building) : null) ?? null,
      category_id: categoryIdByName(a.category),
      criticality: a.criticality as Asset['criticality'],
      make: a.make,
      notes: a.notes,
      ...(isHvac
        ? {
            install_date: `${installYear}-06-01`,
            expected_life_years: 16,
            replacement_cost: a.make === 'Heat pump' ? 7000 : 8500,
          }
        : {}),
    });
  }

  // A little cost history (completed WOs) so spend reports aren't empty.
  const firstHvacAssets = assets.filter(
    (x) => categories.find((c) => c.id === x.category_id)?.name === 'HVAC',
  );
  const seedMidwayWO = (
    asset: Asset | undefined,
    partial: Partial<WorkOrder> & { title: string },
  ) => {
    if (!asset) return;
    workOrders.push(buildWO({ status: 'completed', linked_asset_id: asset.id, ...partial }));
  };
  seedMidwayWO(firstHvacAssets[0], {
    title: 'Annual HVAC service + filter',
    type: 'preventive',
    completed_date: '2026-04-12',
    vendor_name: 'Acme Mechanical',
    actual_vendor_cost: 480,
    actual_parts_cost: 65,
    estimate_cost: 500,
  });
  seedMidwayWO(firstHvacAssets[1], {
    title: 'Compressor capacitor replacement',
    completed_date: '2026-02-03',
    vendor_name: 'Acme Mechanical',
    actual_vendor_cost: 220,
    actual_parts_cost: 38,
    estimate_cost: 200,
  });
  seedMidwayWO(firstHvacAssets[2], {
    title: 'No-cool diagnostic + recharge',
    completed_date: '2026-05-20',
    vendor_name: 'Acme Mechanical',
    actual_vendor_cost: 310,
    estimate_cost: 250,
  });
}
