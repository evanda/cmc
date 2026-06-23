// Data-access boundary for the Phase 0 entities. Two implementations:
//   - supabaseDataSource: the real backend (RLS-enforced).
//   - demoDataSource: in-memory, for offline demo/screenshots (VITE_DEMO=1).
// React Query hooks in queries.ts call `ds` and stay agnostic to which is live.

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
  listUsers(): Promise<User[]>;
  listAssetCategories(): Promise<AssetCategory[]>;
  listAssets(): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | null>;
  createAsset(input: AssetForm): Promise<Asset>;
  updateAsset(id: string, input: AssetForm): Promise<Asset>;
  deleteAsset(id: string): Promise<void>;
  listAssetPhotos(assetId: string): Promise<AssetPhoto[]>;
  addAssetPhoto(assetId: string, file: File): Promise<AssetPhoto>;
  setPrimaryPhoto(assetId: string, photoId: string): Promise<void>;
  deleteAssetPhoto(photoId: string): Promise<void>;
  listWorkOrders(assetId: string): Promise<WorkOrder[]>;
  createWorkOrder(assetId: string, input: WorkLogForm): Promise<WorkOrder>;
}

// Map a "log work" form to a completed work_orders row (history entry).
function workLogPatch(assetId: string, input: WorkLogForm) {
  return {
    title: input.title,
    type: input.type,
    priority: 'medium' as const,
    status: 'completed' as const,
    linked_asset_id: assetId,
    completed_date: input.completed_date ?? null,
    assignee_user_id: input.assignee_user_id ?? null,
    coordinated_by_user_id: input.coordinated_by_user_id ?? null,
    authorized_by_user_id: input.authorized_by_user_id ?? null,
    vendor_name: input.vendor_name ?? null,
    actual_parts_cost: input.actual_parts_cost ?? null,
    actual_labor_cost: input.actual_labor_cost ?? null,
    actual_vendor_cost: input.actual_vendor_cost ?? null,
    labor_hours: input.labor_hours ?? null,
    invoice_number: input.invoice_number ?? null,
    payment_reference: input.payment_reference ?? null,
    completion_notes: input.completion_notes ?? null,
  };
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
    contact_name: input.contact_name ?? null,
    contact_email: input.contact_email ?? null,
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

  listUsers: async () =>
    unwrap<User[]>(
      await supabase.from('users').select('*').is('deleted_at', null).order('name'),
    ),

  listAssetCategories: async () =>
    unwrap<AssetCategory[]>(
      await supabase.from('asset_categories').select('*').is('deleted_at', null).order('name'),
    ),
  listAssets: async () =>
    unwrap<Asset[]>(
      await supabase.from('assets').select('*').is('deleted_at', null).order('name'),
    ),
  getAsset: async (id) =>
    unwrap<Asset | null>(
      await supabase.from('assets').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
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

  listAssetPhotos: async (assetId) =>
    unwrap<AssetPhoto[]>(
      await supabase
        .from('asset_photos')
        .select('*')
        .eq('asset_id', assetId)
        .is('deleted_at', null)
        .order('is_primary', { ascending: false })
        .order('created_at'),
    ),
  addAssetPhoto: async (assetId, file) => {
    const path = `${assetId}/${crypto.randomUUID()}-${file.name}`;
    const up = await supabase.storage.from('asset-photos').upload(path, file);
    if (up.error) throw new Error(up.error.message);
    const { data } = supabase.storage.from('asset-photos').getPublicUrl(path);
    // First photo becomes primary.
    const existing = unwrap<{ id: string }[]>(
      await supabase.from('asset_photos').select('id').eq('asset_id', assetId).is('deleted_at', null),
    );
    return unwrap<AssetPhoto>(
      await supabase
        .from('asset_photos')
        .insert({
          asset_id: assetId,
          url: data.publicUrl,
          caption: file.name,
          is_primary: existing.length === 0,
        })
        .select()
        .single(),
    );
  },
  setPrimaryPhoto: async (assetId, photoId) => {
    unwrap(
      await supabase
        .from('asset_photos')
        .update({ is_primary: false })
        .eq('asset_id', assetId)
        .eq('is_primary', true)
        .select(),
    );
    unwrap(
      await supabase
        .from('asset_photos')
        .update({ is_primary: true })
        .eq('id', photoId)
        .select()
        .single(),
    );
  },
  deleteAssetPhoto: async (photoId) => {
    unwrap(
      await supabase
        .from('asset_photos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', photoId)
        .select()
        .single(),
    );
  },

  listWorkOrders: async (assetId) =>
    unwrap<WorkOrder[]>(
      await supabase
        .from('work_orders')
        .select('*')
        .eq('linked_asset_id', assetId)
        .is('deleted_at', null)
        .order('completed_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
    ),
  createWorkOrder: async (assetId, input) =>
    unwrap<WorkOrder>(
      await supabase.from('work_orders').insert(workLogPatch(assetId, input)).select().single(),
    ),
};

export const ds: DataSource = isDemo ? demoDataSource : supabaseDataSource;
