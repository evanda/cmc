// In-memory demo data source (VITE_DEMO=1 or VITE_DEMO=midway).
// Seed data lives in demo-seed-sample.ts / demo-seed-midway.ts;
// shared state + helpers live in demo-store.ts.
// Mutations update the in-memory store so create/edit/delete flows also work.

import type {
  AssetForm,
  BuildingForm,
  ContactForm,
  FloorForm,
  LocationForm,
  PmScheduleForm,
  ServiceContractForm,
  VendorForm,
  WorkLogForm,
  WorkOrder,
  WorkOrderAttachment,
  WorkOrderForm,
  WorkOrderUpdate,
  WorkRequestForm,
} from '@cmc/shared';
import type { DataSource } from './datasource';
import {
  assets,
  base,
  buildings,
  categories,
  contacts,
  floors,
  id,
  live,
  locations,
  now,
  org,
  photos,
  pmSchedules,
  seedPm,
  serviceContracts,
  users,
  userId,
  vendors,
  woPhotos,
  workOrders,
  buildWO,
} from './demo-store';
import { seedSampleCampus } from './demo-seed-sample';
import { applyMidwayReseed } from './demo-seed-midway';

// ── Seed the campus ──────────────────────────────────────────────────────────

seedSampleCampus();

if (import.meta.env.VITE_DEMO === 'midway') {
  applyMidwayReseed();
}

// PM schedules seeded after the optional midway reseed so `firstHvac` resolves
// to whichever dataset is active (plan §4.3).
const firstHvac = assets.find(
  (a) => categories.find((c) => c.id === a.category_id)?.name === 'HVAC',
);
seedPm({
  name: 'HVAC filter swap',
  interval_value: 3,
  interval_unit: 'month',
  category: 'HVAC',
  anchor_date: '2026-04-01',
  asset_id: firstHvac?.id ?? null,
  assignee_user_id: userId('Sam Tech'),
});
seedPm({
  name: 'Fire-extinguisher check',
  interval_value: 1,
  interval_unit: 'month',
  is_compliance: true,
  category: 'Compliance',
  anchor_date: '2026-06-01',
});
seedPm({
  name: 'Backflow preventer test',
  trigger_type: 'fixed_date',
  fixed_month: 4,
  fixed_day: 15,
  is_compliance: true,
  category: 'Compliance',
  anchor_date: '2026-01-01',
});
seedPm({
  name: 'Roof inspection',
  interval_value: 1,
  interval_unit: 'year',
  anchor_date: '2025-09-15',
  category: 'Roofing',
});
seedPm({
  name: 'Playground safety inspection',
  interval_value: 1,
  interval_unit: 'month',
  is_compliance: true,
  anchor_date: '2026-06-10',
});

// ── DataSource implementation ────────────────────────────────────────────────

export const demoDataSource: DataSource = {
  getOrgSettings: async () => org,
  updateOrgSettings: async (input) => {
    Object.assign(org, {
      facility_name: input.facility_name,
      address: input.address ?? null,
      maintenance_contact_email: input.maintenance_contact_email ?? null,
      locale: input.locale,
      distance_unit: input.distance_unit,
      currency: input.currency,
      timezone: input.timezone,
    });
    return org;
  },

  listBuildings: async () =>
    (live(buildings) as typeof buildings).sort((a, b) => a.name.localeCompare(b.name)),
  createBuilding: async (input: BuildingForm) => {
    const b = {
      id: id(),
      ...base(),
      name: input.name,
      description: input.description ?? null,
      address: input.address ?? null,
      footprint_geojson: null,
    } as (typeof buildings)[0];
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
    (live(floors) as typeof floors)
      .filter((f) => !buildingId || f.building_id === buildingId)
      .sort((a, b) => a.level - b.level),
  createFloor: async (input: FloorForm) => {
    const f = {
      id: id(),
      ...base(),
      building_id: input.building_id,
      name: input.name,
      level: input.level,
      floorplan_image_url: null,
      geo_corners_geojson: null,
      rotation_deg: null,
    } as (typeof floors)[0];
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
    (live(locations) as typeof locations)
      .filter((l) => !buildingId || l.building_id === buildingId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  createLocation: async (input: LocationForm) => {
    const l = {
      id: id(),
      ...base(),
      building_id: input.building_id,
      floor_id: input.floor_id ?? null,
      name: input.name,
      type: input.type ?? null,
    } as (typeof locations)[0];
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
  updateUserRole: async (uid, role) => {
    const u = users.find((x) => x.id === uid)!;
    u.role = role;
    return u;
  },

  listAssetCategories: async () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),

  listAssets: async () =>
    (live(assets) as typeof assets).sort((a, b) => a.name.localeCompare(b.name)),
  getAsset: async (aid) => assets.find((a) => a.id === aid && a.deleted_at === null) ?? null,
  getAssetByQrToken: async (token) =>
    assets.find((a) => a.qr_token === token && a.deleted_at === null) ?? null,
  ensureAssetQrToken: async (aid) => {
    const a = assets.find((x) => x.id === aid)!;
    if (!a.qr_token) a.qr_token = `demo${aid.replace(/\D/g, '')}token`;
    return a.qr_token;
  },
  createAsset: async (input: AssetForm) => {
    const a = {
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
    } as (typeof assets)[0];
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
    (live(photos) as typeof photos)
      .filter((p) => p.asset_id === assetId)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
  addAssetPhoto: async (assetId, file) => {
    const url = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    const first = !photos.some((p) => p.asset_id === assetId && p.deleted_at === null);
    const p = {
      id: id(),
      ...base(),
      asset_id: assetId,
      url,
      caption: file.name,
      is_primary: first,
      taken_at: now,
    } as (typeof photos)[0];
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
      vendor_id: input.vendor_id ?? null,
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
      source_pm_id: null,
    };
    workOrders.push(w);
    return w;
  },

  listWorkOrderPhotos: async (workOrderId) =>
    (live(woPhotos) as WorkOrderAttachment[])
      .filter((p) => p.work_order_id === workOrderId)
      .sort((a, b) => a.kind.localeCompare(b.kind)),
  addWorkOrderPhoto: async (workOrderId, file, kind) => {
    const url = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    const p: WorkOrderAttachment = {
      id: id(),
      ...base(),
      work_order_id: workOrderId,
      url,
      kind,
      caption: file.name,
      taken_at: now,
    };
    woPhotos.push(p);
    return p;
  },
  deleteWorkOrderPhoto: async (photoId) => {
    const p = woPhotos.find((x) => x.id === photoId);
    if (p) p.deleted_at = now;
  },

  listAllWorkOrders: async () =>
    (live(workOrders) as WorkOrder[]).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  createWorkOrderFromForm: async (input: WorkOrderForm) => {
    const w = buildWO({
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
    });
    workOrders.push(w);
    return w;
  },
  updateWorkOrder: async (woId, patch: WorkOrderUpdate) => {
    const w = workOrders.find((x) => x.id === woId)!;
    w.status = patch.status;
    w.priority = patch.priority;
    w.assignee_user_id = patch.assignee_user_id ?? null;
    if (patch.status === 'completed' && !w.completed_date) w.completed_date = '2026-06-23';
    return w;
  },

  listWorkRequests: async () =>
    (live(workOrders) as WorkOrder[])
      .filter((w) => w.status === 'requested')
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  createWorkRequest: async (input: WorkRequestForm) => {
    const w = buildWO({
      title: input.title,
      description: input.description ?? null,
      location_id: input.location_id ?? null,
      linked_asset_id: input.linked_asset_id ?? null,
      requested_by: 'demo-admin',
      status: 'requested',
    });
    workOrders.push(w);
    return w;
  },
  acceptWorkRequest: async (requestId) => {
    const w = workOrders.find((x) => x.id === requestId)!;
    w.status = 'open';
    return w;
  },
  declineWorkRequest: async (requestId) => {
    const w = workOrders.find((x) => x.id === requestId);
    if (w) w.status = 'cancelled';
  },

  listVendors: async () =>
    (live(vendors) as typeof vendors).sort((a, b) => a.name.localeCompare(b.name)),
  createVendor: async (input: VendorForm) => {
    const v = {
      id: id(),
      ...base(),
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
    } as (typeof vendors)[0];
    vendors.push(v);
    return v;
  },
  updateVendor: async (vid, input: VendorForm) => {
    const v = vendors.find((x) => x.id === vid)!;
    Object.assign(v, {
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
    });
    return v;
  },
  deleteVendor: async (vid) => {
    const v = vendors.find((x) => x.id === vid);
    if (v) v.deleted_at = now;
  },

  listServiceContracts: async () =>
    (live(serviceContracts) as typeof serviceContracts).sort((a, b) =>
      a.description.localeCompare(b.description),
    ),
  createServiceContract: async (input: ServiceContractForm) => {
    const c = {
      id: id(),
      ...base(),
      vendor_id: input.vendor_id ?? null,
      description: input.description,
      cadence: input.cadence ?? null,
      cost: input.cost ?? null,
      period_unit: input.period_unit ?? null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      renewal_reminder_days: input.renewal_reminder_days ?? null,
    } as (typeof serviceContracts)[0];
    serviceContracts.push(c);
    return c;
  },
  updateServiceContract: async (cid, input: ServiceContractForm) => {
    const c = serviceContracts.find((x) => x.id === cid)!;
    Object.assign(c, {
      vendor_id: input.vendor_id ?? null,
      description: input.description,
      cadence: input.cadence ?? null,
      cost: input.cost ?? null,
      period_unit: input.period_unit ?? null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      renewal_reminder_days: input.renewal_reminder_days ?? null,
    });
    return c;
  },
  deleteServiceContract: async (cid) => {
    const c = serviceContracts.find((x) => x.id === cid);
    if (c) c.deleted_at = now;
  },

  listContacts: async () =>
    (live(contacts) as typeof contacts).sort((a, b) => a.name.localeCompare(b.name)),
  createContact: async (input: ContactForm) => {
    const c = {
      id: id(),
      ...base(),
      name: input.name,
      org: input.org ?? null,
      role: input.role ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      account_number: input.account_number ?? null,
      notes: input.notes ?? null,
    } as (typeof contacts)[0];
    contacts.push(c);
    return c;
  },
  updateContact: async (cid, input: ContactForm) => {
    const c = contacts.find((x) => x.id === cid)!;
    Object.assign(c, {
      name: input.name,
      org: input.org ?? null,
      role: input.role ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      account_number: input.account_number ?? null,
      notes: input.notes ?? null,
    });
    return c;
  },
  deleteContact: async (cid) => {
    const c = contacts.find((x) => x.id === cid);
    if (c) c.deleted_at = now;
  },

  listPmSchedules: async () =>
    (live(pmSchedules) as typeof pmSchedules).sort((a, b) => a.name.localeCompare(b.name)),
  createPmSchedule: async (input: PmScheduleForm) => {
    const s = {
      id: id(),
      ...base(),
      name: input.name,
      asset_id: input.asset_id ?? null,
      location_id: null,
      task_template_id: null,
      trigger_type: input.trigger_type,
      interval_value: input.interval_value ?? null,
      interval_unit: input.interval_unit ?? null,
      fixed_month: input.fixed_month ?? null,
      fixed_day: input.fixed_day ?? null,
      meter_id: null,
      meter_threshold: input.meter_threshold ?? null,
      anchor_date: input.anchor_date,
      advance_from: 'completion',
      lead_time_days: input.lead_time_days,
      assignee_user_id: input.assignee_user_id ?? null,
      vendor_id: null,
      is_compliance: input.is_compliance,
      category: input.category ?? null,
      active: true,
    } as (typeof pmSchedules)[0];
    pmSchedules.push(s);
    return s;
  },
  deletePmSchedule: async (sid) => {
    const s = pmSchedules.find((x) => x.id === sid);
    if (s) s.deleted_at = now;
  },
};

