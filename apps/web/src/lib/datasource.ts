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
  Contact,
  ContactForm,
  Floor,
  FloorForm,
  Location,
  LocationForm,
  OrgSettings,
  ServiceContract,
  ServiceContractForm,
  User,
  UserRole,
  Vendor,
  VendorForm,
  WorkLogForm,
  WorkOrder,
  WorkOrderAttachment,
  WorkOrderForm,
  WorkOrderPhotoKind,
  WorkOrderUpdate,
  WorkRequest,
  WorkRequestForm,
} from '@cmc/shared';
import { requestToWorkOrder } from '@cmc/shared';
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
  updateUserRole(userId: string, role: UserRole): Promise<User>;
  listAssetCategories(): Promise<AssetCategory[]>;
  listAssets(): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | null>;
  getAssetByQrToken(token: string): Promise<Asset | null>;
  ensureAssetQrToken(assetId: string): Promise<string>;
  createAsset(input: AssetForm): Promise<Asset>;
  updateAsset(id: string, input: AssetForm): Promise<Asset>;
  deleteAsset(id: string): Promise<void>;
  listAssetPhotos(assetId: string): Promise<AssetPhoto[]>;
  addAssetPhoto(assetId: string, file: File): Promise<AssetPhoto>;
  setPrimaryPhoto(assetId: string, photoId: string): Promise<void>;
  deleteAssetPhoto(photoId: string): Promise<void>;
  listWorkOrders(assetId: string): Promise<WorkOrder[]>;
  createWorkOrder(assetId: string, input: WorkLogForm): Promise<WorkOrder>;
  listWorkOrderPhotos(workOrderId: string): Promise<WorkOrderAttachment[]>;
  addWorkOrderPhoto(
    workOrderId: string,
    file: File,
    kind: WorkOrderPhotoKind,
  ): Promise<WorkOrderAttachment>;
  deleteWorkOrderPhoto(photoId: string): Promise<void>;
  // Board: all work orders across assets, plus create/update.
  listAllWorkOrders(): Promise<WorkOrder[]>;
  createWorkOrderFromForm(input: WorkOrderForm): Promise<WorkOrder>;
  updateWorkOrder(id: string, patch: WorkOrderUpdate): Promise<WorkOrder>;
  // Work requests intake + triage.
  listWorkRequests(): Promise<WorkRequest[]>;
  createWorkRequest(input: WorkRequestForm): Promise<WorkRequest>;
  convertWorkRequest(requestId: string): Promise<WorkOrder>;
  declineWorkRequest(requestId: string): Promise<void>;
  // Vendors, service contracts, contacts (plan §4.5).
  listVendors(): Promise<Vendor[]>;
  createVendor(input: VendorForm): Promise<Vendor>;
  updateVendor(id: string, input: VendorForm): Promise<Vendor>;
  deleteVendor(id: string): Promise<void>;
  listServiceContracts(): Promise<ServiceContract[]>;
  createServiceContract(input: ServiceContractForm): Promise<ServiceContract>;
  updateServiceContract(id: string, input: ServiceContractForm): Promise<ServiceContract>;
  deleteServiceContract(id: string): Promise<void>;
  listContacts(): Promise<Contact[]>;
  createContact(input: ContactForm): Promise<Contact>;
  updateContact(id: string, input: ContactForm): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
}

function vendorPatch(input: VendorForm) {
  return {
    name: input.name,
    category: input.category ?? null,
    contact_name: input.contact_name ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
    rate: input.rate ?? null,
    coi_expiry: input.coi_expiry ?? null,
    contract_expiry: input.contract_expiry ?? null,
    notes: input.notes ?? null,
  };
}

function serviceContractPatch(input: ServiceContractForm) {
  return {
    vendor_id: input.vendor_id ?? null,
    description: input.description,
    cadence: input.cadence ?? null,
    cost: input.cost ?? null,
    period_unit: input.period_unit ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    renewal_reminder_days: input.renewal_reminder_days ?? null,
  };
}

// Stable, unguessable slug for a QR sticker (plan §3 — survives reprints).
function genQrToken() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function contactPatch(input: ContactForm) {
  return {
    name: input.name,
    org: input.org ?? null,
    role: input.role ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    account_number: input.account_number ?? null,
    notes: input.notes ?? null,
  };
}

// Status edits also stamp completed_date when a WO is marked completed.
function workOrderUpdatePatch(patch: WorkOrderUpdate) {
  return {
    status: patch.status,
    priority: patch.priority,
    assignee_user_id: patch.assignee_user_id ?? null,
    ...(patch.status === 'completed' ? { completed_date: new Date().toISOString().slice(0, 10) } : {}),
  };
}

function workOrderFormPatch(input: WorkOrderForm) {
  return {
    title: input.title,
    description: input.description ?? null,
    type: input.type,
    priority: input.priority,
    status: input.status,
    linked_asset_id: input.linked_asset_id ?? null,
    location_id: input.location_id ?? null,
    assignee_user_id: input.assignee_user_id ?? null,
    vendor_id: input.vendor_id ?? null,
    due_date: input.due_date ?? null,
  };
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
    vendor_id: input.vendor_id ?? null,
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
  updateUserRole: async (userId, role) =>
    unwrap<User>(
      await supabase.from('users').update({ role }).eq('id', userId).select().single(),
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
  getAssetByQrToken: async (token) =>
    unwrap<Asset | null>(
      await supabase
        .from('assets')
        .select('*')
        .eq('qr_token', token)
        .is('deleted_at', null)
        .maybeSingle(),
    ),
  ensureAssetQrToken: async (assetId) => {
    const existing = unwrap<{ qr_token: string | null } | null>(
      await supabase.from('assets').select('qr_token').eq('id', assetId).maybeSingle(),
    );
    if (existing?.qr_token) return existing.qr_token;
    const token = genQrToken();
    unwrap(await supabase.from('assets').update({ qr_token: token }).eq('id', assetId).select().single());
    return token;
  },
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

  listWorkOrderPhotos: async (workOrderId) =>
    unwrap<WorkOrderAttachment[]>(
      await supabase
        .from('work_order_attachments')
        .select('*')
        .eq('work_order_id', workOrderId)
        .is('deleted_at', null)
        .order('kind')
        .order('created_at'),
    ),
  addWorkOrderPhoto: async (workOrderId, file, kind) => {
    const path = `${workOrderId}/${kind}-${crypto.randomUUID()}-${file.name}`;
    const up = await supabase.storage.from('work-order-photos').upload(path, file);
    if (up.error) throw new Error(up.error.message);
    const { data } = supabase.storage.from('work-order-photos').getPublicUrl(path);
    return unwrap<WorkOrderAttachment>(
      await supabase
        .from('work_order_attachments')
        .insert({ work_order_id: workOrderId, url: data.publicUrl, kind, caption: file.name })
        .select()
        .single(),
    );
  },
  deleteWorkOrderPhoto: async (photoId) => {
    unwrap(
      await supabase
        .from('work_order_attachments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', photoId)
        .select()
        .single(),
    );
  },

  listAllWorkOrders: async () =>
    unwrap<WorkOrder[]>(
      await supabase
        .from('work_orders')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ),
  createWorkOrderFromForm: async (input) =>
    unwrap<WorkOrder>(
      await supabase.from('work_orders').insert(workOrderFormPatch(input)).select().single(),
    ),
  updateWorkOrder: async (id, patch) =>
    unwrap<WorkOrder>(
      await supabase
        .from('work_orders')
        .update(workOrderUpdatePatch(patch))
        .eq('id', id)
        .select()
        .single(),
    ),

  listWorkRequests: async () =>
    unwrap<WorkRequest[]>(
      await supabase
        .from('work_requests')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ),
  createWorkRequest: async (input) =>
    unwrap<WorkRequest>(
      await supabase
        .from('work_requests')
        .insert({
          title: input.title,
          description: input.description ?? null,
          linked_asset_id: input.linked_asset_id ?? null,
          location_id: input.location_id ?? null,
          status: 'open',
        })
        .select()
        .single(),
    ),
  convertWorkRequest: async (requestId) => {
    const req = unwrap<WorkRequest>(
      await supabase.from('work_requests').select('*').eq('id', requestId).single(),
    );
    const wo = unwrap<WorkOrder>(
      await supabase.from('work_orders').insert(requestToWorkOrder(req)).select().single(),
    );
    unwrap(
      await supabase
        .from('work_requests')
        .update({ status: 'converted' })
        .eq('id', requestId)
        .select()
        .single(),
    );
    return wo;
  },
  declineWorkRequest: async (requestId) => {
    unwrap(
      await supabase
        .from('work_requests')
        .update({ status: 'declined' })
        .eq('id', requestId)
        .select()
        .single(),
    );
  },

  listVendors: async () =>
    unwrap<Vendor[]>(
      await supabase.from('vendors').select('*').is('deleted_at', null).order('name'),
    ),
  createVendor: async (input) =>
    unwrap<Vendor>(await supabase.from('vendors').insert(vendorPatch(input)).select().single()),
  updateVendor: async (id, input) =>
    unwrap<Vendor>(
      await supabase.from('vendors').update(vendorPatch(input)).eq('id', id).select().single(),
    ),
  deleteVendor: async (id) => {
    unwrap(
      await supabase
        .from('vendors')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single(),
    );
  },

  listServiceContracts: async () =>
    unwrap<ServiceContract[]>(
      await supabase
        .from('service_contracts')
        .select('*')
        .is('deleted_at', null)
        .order('description'),
    ),
  createServiceContract: async (input) =>
    unwrap<ServiceContract>(
      await supabase.from('service_contracts').insert(serviceContractPatch(input)).select().single(),
    ),
  updateServiceContract: async (id, input) =>
    unwrap<ServiceContract>(
      await supabase
        .from('service_contracts')
        .update(serviceContractPatch(input))
        .eq('id', id)
        .select()
        .single(),
    ),
  deleteServiceContract: async (id) => {
    unwrap(
      await supabase
        .from('service_contracts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single(),
    );
  },

  listContacts: async () =>
    unwrap<Contact[]>(
      await supabase.from('contacts').select('*').is('deleted_at', null).order('name'),
    ),
  createContact: async (input) =>
    unwrap<Contact>(await supabase.from('contacts').insert(contactPatch(input)).select().single()),
  updateContact: async (id, input) =>
    unwrap<Contact>(
      await supabase.from('contacts').update(contactPatch(input)).eq('id', id).select().single(),
    ),
  deleteContact: async (id) => {
    unwrap(
      await supabase
        .from('contacts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single(),
    );
  },
};

export const ds: DataSource = isDemo ? demoDataSource : supabaseDataSource;
