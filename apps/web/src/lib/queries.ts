import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Building,
  BuildingForm,
  Floor,
  FloorForm,
  Location,
  LocationForm,
  OrgSettings,
} from '@cmc/shared';
import { supabase } from './supabase';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ── org_settings (single row, plan §7.6) ─────────────────────────────────────
export function useOrgSettings() {
  return useQuery({
    queryKey: ['org_settings'],
    queryFn: async () =>
      unwrap<OrgSettings | null>(
        await supabase.from('org_settings').select('*').maybeSingle(),
      ),
  });
}

// ── buildings ────────────────────────────────────────────────────────────────
export function useBuildings() {
  return useQuery({
    queryKey: ['buildings'],
    queryFn: async () =>
      unwrap<Building[]>(
        await supabase
          .from('buildings')
          .select('*')
          .is('deleted_at', null)
          .order('name'),
      ),
  });
}

export function useCreateBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BuildingForm) =>
      unwrap<Building>(await supabase.from('buildings').insert(input).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['buildings'] }),
  });
}

export function useUpdateBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: BuildingForm & { id: string }) =>
      unwrap<Building>(
        await supabase.from('buildings').update(input).eq('id', id).select().single(),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['buildings'] }),
  });
}

export function useDeleteBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(
        await supabase
          .from('buildings')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single(),
      );
    },
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
    queryFn: async () => {
      let q = supabase.from('floors').select('*').is('deleted_at', null);
      if (buildingId) q = q.eq('building_id', buildingId);
      return unwrap<Floor[]>(await q.order('level'));
    },
  });
}

export function useCreateFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FloorForm) =>
      unwrap<Floor>(await supabase.from('floors').insert(input).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['floors'] }),
  });
}

export function useUpdateFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: FloorForm & { id: string }) =>
      unwrap<Floor>(await supabase.from('floors').update(input).eq('id', id).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['floors'] }),
  });
}

export function useDeleteFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(
        await supabase
          .from('floors')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['floors'] }),
  });
}

// ── locations ──────────────────────────────────────────────────────────────
export function useLocations(buildingId?: string) {
  return useQuery({
    queryKey: ['locations', buildingId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('locations').select('*').is('deleted_at', null);
      if (buildingId) q = q.eq('building_id', buildingId);
      return unwrap<Location[]>(await q.order('name'));
    },
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LocationForm) =>
      unwrap<Location>(
        await supabase
          .from('locations')
          .insert({ ...input, floor_id: input.floor_id ?? null })
          .select()
          .single(),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: LocationForm & { id: string }) =>
      unwrap<Location>(
        await supabase
          .from('locations')
          .update({ ...input, floor_id: input.floor_id ?? null })
          .eq('id', id)
          .select()
          .single(),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(
        await supabase
          .from('locations')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });
}
