import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AssetForm,
  BuildingForm,
  ContactForm,
  FloorForm,
  LocationForm,
  ServiceContractForm,
  VendorForm,
  WorkLogForm,
  WorkOrderForm,
  WorkOrderPhotoKind,
  WorkOrderUpdate,
  WorkRequestForm,
} from '@cmc/shared';
import { ds } from './datasource';

// Generic CRUD-hook factory to cut boilerplate for the directory entities.
function crudHooks<TRow, TForm>(
  key: string,
  ops: {
    list: () => Promise<TRow[]>;
    create: (input: TForm) => Promise<TRow>;
    update: (id: string, input: TForm) => Promise<TRow>;
    remove: (id: string) => Promise<void>;
  },
) {
  return {
    useList: () => useQuery({ queryKey: [key], queryFn: ops.list }),
    useCreate: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (input: TForm) => ops.create(input),
        onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
      });
    },
    useUpdate: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: ({ id, ...input }: TForm & { id: string }) => ops.update(id, input as TForm),
        onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
      });
    },
    useDelete: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (id: string) => ops.remove(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: [key] }),
      });
    },
  };
}

// ── org_settings (single row, plan §7.6) ─────────────────────────────────────
export function useOrgSettings() {
  return useQuery({ queryKey: ['org_settings'], queryFn: () => ds.getOrgSettings() });
}

// ── buildings ────────────────────────────────────────────────────────────────
export function useBuildings() {
  return useQuery({ queryKey: ['buildings'], queryFn: () => ds.listBuildings() });
}

export function useCreateBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BuildingForm) => ds.createBuilding(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['buildings'] }),
  });
}

export function useUpdateBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: BuildingForm & { id: string }) => ds.updateBuilding(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['buildings'] }),
  });
}

export function useDeleteBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteBuilding(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['buildings'] });
      qc.invalidateQueries({ queryKey: ['floors'] });
      qc.invalidateQueries({ queryKey: ['locations'] });
    },
  });
}

// ── floors ───────────────────────────────────────────────────────────────────
export function useFloors(buildingId?: string) {
  return useQuery({
    queryKey: ['floors', buildingId ?? 'all'],
    queryFn: () => ds.listFloors(buildingId),
  });
}

export function useCreateFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FloorForm) => ds.createFloor(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['floors'] }),
  });
}

export function useUpdateFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: FloorForm & { id: string }) => ds.updateFloor(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['floors'] }),
  });
}

export function useDeleteFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteFloor(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['floors'] }),
  });
}

// ── locations ──────────────────────────────────────────────────────────────
export function useLocations(buildingId?: string) {
  return useQuery({
    queryKey: ['locations', buildingId ?? 'all'],
    queryFn: () => ds.listLocations(buildingId),
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LocationForm) => ds.createLocation(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: LocationForm & { id: string }) => ds.updateLocation(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteLocation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });
}

// ── asset registry (plan §4.1) ───────────────────────────────────────────────
export function useAssetCategories() {
  return useQuery({ queryKey: ['asset_categories'], queryFn: () => ds.listAssetCategories() });
}

export function useAssets() {
  return useQuery({ queryKey: ['assets'], queryFn: () => ds.listAssets() });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssetForm) => ds.createAsset(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: AssetForm & { id: string }) => ds.updateAsset(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deleteAsset(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });
}

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: () => ds.listUsers() });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: import('@cmc/shared').UserRole }) =>
      ds.updateUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useAsset(id: string) {
  return useQuery({ queryKey: ['asset', id], queryFn: () => ds.getAsset(id) });
}

export function useAssetByQrToken(token: string) {
  return useQuery({ queryKey: ['asset_by_qr', token], queryFn: () => ds.getAssetByQrToken(token) });
}

export function useEnsureAssetQrToken(assetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ds.ensureAssetQrToken(assetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset', assetId] }),
  });
}

// ── asset photos (plan §4.1) ─────────────────────────────────────────────────
export function useAssetPhotos(assetId: string) {
  return useQuery({ queryKey: ['asset_photos', assetId], queryFn: () => ds.listAssetPhotos(assetId) });
}

export function useAddAssetPhoto(assetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => ds.addAssetPhoto(assetId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset_photos', assetId] }),
  });
}

export function useSetPrimaryPhoto(assetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => ds.setPrimaryPhoto(assetId, photoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset_photos', assetId] }),
  });
}

export function useDeleteAssetPhoto(assetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => ds.deleteAssetPhoto(photoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset_photos', assetId] }),
  });
}

// ── work orders / asset history (plan §4.2) ──────────────────────────────────
export function useWorkOrders(assetId: string) {
  return useQuery({ queryKey: ['work_orders', assetId], queryFn: () => ds.listWorkOrders(assetId) });
}

export function useCreateWorkOrder(assetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkLogForm) => ds.createWorkOrder(assetId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work_orders', assetId] }),
  });
}

// ── work-order photos: before (damage) / after (proof) (plan §4.2) ───────────
export function useWorkOrderPhotos(workOrderId: string) {
  return useQuery({
    queryKey: ['work_order_photos', workOrderId],
    queryFn: () => ds.listWorkOrderPhotos(workOrderId),
  });
}

export function useAddWorkOrderPhoto(workOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: WorkOrderPhotoKind }) =>
      ds.addWorkOrderPhoto(workOrderId, file, kind),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work_order_photos', workOrderId] }),
  });
}

export function useDeleteWorkOrderPhoto(workOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => ds.deleteWorkOrderPhoto(photoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work_order_photos', workOrderId] }),
  });
}

// ── work orders board (all WOs across assets) ────────────────────────────────
export function useAllWorkOrders() {
  return useQuery({ queryKey: ['all_work_orders'], queryFn: () => ds.listAllWorkOrders() });
}

function invalidateWorkOrders(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['all_work_orders'] });
  qc.invalidateQueries({ queryKey: ['work_orders'] }); // asset-scoped history
}

export function useCreateWorkOrderFromForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkOrderForm) => ds.createWorkOrderFromForm(input),
    onSuccess: () => invalidateWorkOrders(qc),
  });
}

export function useUpdateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: WorkOrderUpdate }) =>
      ds.updateWorkOrder(id, patch),
    onSuccess: () => invalidateWorkOrders(qc),
  });
}

// ── request intake + triage (plan §3.1) ──────────────────────────────────────
// A "request" is a work order in 'requested' status; these all touch
// work_orders, so they invalidate both the request inbox and the WO board.
function invalidateRequests(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['work_requests'] });
  invalidateWorkOrders(qc);
}

export function useWorkRequests() {
  return useQuery({ queryKey: ['work_requests'], queryFn: () => ds.listWorkRequests() });
}

export function useCreateWorkRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkRequestForm) => ds.createWorkRequest(input),
    onSuccess: () => invalidateRequests(qc),
  });
}

export function useAcceptWorkRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => ds.acceptWorkRequest(requestId),
    onSuccess: () => invalidateRequests(qc),
  });
}

export function useDeclineWorkRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => ds.declineWorkRequest(requestId),
    onSuccess: () => invalidateRequests(qc),
  });
}

// ── vendors / service contracts / contacts (plan §4.5) ───────────────────────
const vendorHooks = crudHooks<import('@cmc/shared').Vendor, VendorForm>('vendors', {
  list: () => ds.listVendors(),
  create: (i) => ds.createVendor(i),
  update: (id, i) => ds.updateVendor(id, i),
  remove: (id) => ds.deleteVendor(id),
});
export const useVendors = vendorHooks.useList;
export const useCreateVendor = vendorHooks.useCreate;
export const useUpdateVendor = vendorHooks.useUpdate;
export const useDeleteVendor = vendorHooks.useDelete;

const contractHooks = crudHooks<import('@cmc/shared').ServiceContract, ServiceContractForm>(
  'service_contracts',
  {
    list: () => ds.listServiceContracts(),
    create: (i) => ds.createServiceContract(i),
    update: (id, i) => ds.updateServiceContract(id, i),
    remove: (id) => ds.deleteServiceContract(id),
  },
);
export const useServiceContracts = contractHooks.useList;
export const useCreateServiceContract = contractHooks.useCreate;
export const useUpdateServiceContract = contractHooks.useUpdate;
export const useDeleteServiceContract = contractHooks.useDelete;

const contactHooks = crudHooks<import('@cmc/shared').Contact, ContactForm>('contacts', {
  list: () => ds.listContacts(),
  create: (i) => ds.createContact(i),
  update: (id, i) => ds.updateContact(id, i),
  remove: (id) => ds.deleteContact(id),
});
export const useContacts = contactHooks.useList;
export const useCreateContact = contactHooks.useCreate;
export const useUpdateContact = contactHooks.useUpdate;
export const useDeleteContact = contactHooks.useDelete;

// ── preventive maintenance (plan §4.3) ───────────────────────────────────────
export function usePmSchedules() {
  return useQuery({ queryKey: ['pm_schedules'], queryFn: () => ds.listPmSchedules() });
}

export function useCreatePmSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: import('@cmc/shared').PmScheduleForm) => ds.createPmSchedule(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pm_schedules'] }),
  });
}

export function useDeletePmSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ds.deletePmSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pm_schedules'] }),
  });
}
