// Data-access boundary for the Phase 0 entities. Two implementations:
//   - supabaseDataSource: the real backend (RLS-enforced).
//   - demoDataSource: in-memory, for offline demo/screenshots (VITE_DEMO=1).
// React Query hooks in queries.ts call `ds` and stay agnostic to which is live.

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
import { supabase, isDemo } from './supabase';
import { demoDataSource } from './demo';

export interface DataSource {
  getOrgSettings(): Promise<OrgSettings | null>;
  listBuildings(): Promise<Building[]>;
  createBuilding(input: BuildingForm): Promise<Building>;
  updateBuilding(id: string, input: BuildingForm): Promise<Building>;
  deleteBuilding(id: string): Promise<void>;
  listFloors(buildingId?: string): Promise<Floor[]>;
  createFloor(input: FloorForm): Promise<Floor>;
  updateFloor(id: string, input: FloorForm): Promise<Floor>;
  deleteFloor(id: string): Promise<void>;
  listLocations(buildingId?: string): Promise<Location[]>;
  createLocation(input: LocationForm): Promise<Location>;
  updateLocation(id: string, input: LocationForm): Promise<Location>;
  deleteLocation(id: string): Promise<void>;
  listAssetCategories(): Promise<AssetCategory[]>;
  listAssets(): Promise<Asset[]>;
  createAsset(input: AssetForm): Promise<Asset>;
  updateAsset(id: string, input: AssetForm): Promise<Asset>;
  deleteAsset(id: string): Promise<void>;
}

// Normalize the nullable FK / optional fields an AssetForm carries into a row patch.
function assetPatch(input: AssetForm) {
  return {
    name: input.name,
    category_id: input.category_id ?? null,
    location_id: input.location_id ?? null,
    make: input.make ?? null,
    model: input.model ?? null,
    serial: input.serial ?? null,
    criticality: input.criticality,
    status: input.status,
    notes: input.notes ?? null,
  };
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const supabaseDataSource: DataSource = {
  getOrgSettings: async () =>
    unwrap<OrgSettings | null>(await supabase.from('org_settings').select('*').maybeSingle()),

  listBuildings: async () =>
    unwrap<Building[]>(
      await supabase.from('buildings').select('*').is('deleted_at', null).order('name'),
    ),
  createBuilding: async (input) =>
    unwrap<Building>(await supabase.from('buildings').insert(input).select().single()),
  updateBuilding: async (id, input) =>
    unwrap<Building>(await supabase.from('buildings').update(input).eq('id', id).select().single()),
  deleteBuilding: async (id) => {
    unwrap(
      await supabase
        .from('buildings')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single(),
    );
  },

  listFloors: async (buildingId) => {
    let q = supabase.from('floors').select('*').is('deleted_at', null);
    if (buildingId) q = q.eq('building_id', buildingId);
    return unwrap<Floor[]>(await q.order('level'));
  },
  createFloor: async (input) =>
    unwrap<Floor>(await supabase.from('floors').insert(input).select().single()),
  updateFloor: async (id, input) =>
    unwrap<Floor>(await supabase.from('floors').update(input).eq('id', id).select().single()),
  deleteFloor: async (id) => {
    unwrap(
      await supabase
        .from('floors')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single(),
    );
  },

  listLocations: async (buildingId) => {
    let q = supabase.from('locations').select('*').is('deleted_at', null);
    if (buildingId) q = q.eq('building_id', buildingId);
    return unwrap<Location[]>(await q.order('name'));
  },
  createLocation: async (input) =>
    unwrap<Location>(
      await supabase
        .from('locations')
        .insert({ ...input, floor_id: input.floor_id ?? null })
        .select()
        .single(),
    ),
  updateLocation: async (id, input) =>
    unwrap<Location>(
      await supabase
        .from('locations')
        .update({ ...input, floor_id: input.floor_id ?? null })
        .eq('id', id)
        .select()
        .single(),
    ),
  deleteLocation: async (id) => {
    unwrap(
      await supabase
        .from('locations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single(),
    );
  },

  listAssetCategories: async () =>
    unwrap<AssetCategory[]>(
      await supabase.from('asset_categories').select('*').is('deleted_at', null).order('name'),
    ),
  listAssets: async () =>
    unwrap<Asset[]>(
      await supabase.from('assets').select('*').is('deleted_at', null).order('name'),
    ),
  createAsset: async (input) =>
    unwrap<Asset>(await supabase.from('assets').insert(assetPatch(input)).select().single()),
  updateAsset: async (id, input) =>
    unwrap<Asset>(
      await supabase.from('assets').update(assetPatch(input)).eq('id', id).select().single(),
    ),
  deleteAsset: async (id) => {
    unwrap(
      await supabase
        .from('assets')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single(),
    );
  },
};

export const ds: DataSource = isDemo ? demoDataSource : supabaseDataSource;
