import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssetForm, BuildingForm, FloorForm, LocationForm } from '@cmc/shared';
import { ds } from './datasource';

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
