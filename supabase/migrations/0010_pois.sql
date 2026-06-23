-- ───────────────────────────────────────────────────────────────────────────
-- 0010_pois.sql — map Points of Interest (plan §5.4, §6)
--
-- One coordinate system: a POI is a clickable lng/lat marker tagged with a
-- `level` (floor) and optionally linked to an asset. Backs the campus map and
-- the "where's the main water shutoff?" lookup.
-- ───────────────────────────────────────────────────────────────────────────
create table public.pois (
  id               uuid primary key default gen_random_uuid(),
  building_id      uuid references public.buildings (id) on delete set null,
  floor_id         uuid references public.floors (id) on delete set null,
  level            integer,                       -- null/0 = exterior/site (plan §5.4)
  geometry_geojson jsonb not null,                -- GeoJSON Point (lng/lat)
  poi_type         text not null,                 -- hvac | shutoff | network_hardware | …
  linked_asset_id  uuid references public.assets (id) on delete set null,
  label            text,
  icon             text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  deleted_at       timestamptz
);
create index pois_building_id_idx on public.pois (building_id);
create index pois_level_idx on public.pois (level);
create index pois_linked_asset_id_idx on public.pois (linked_asset_id);
create trigger pois_set_updated_at
  before update on public.pois for each row execute function public.set_updated_at();

-- RLS (plan §7.5): read for authenticated; staff (admin/technician) writes.
alter table public.pois enable row level security;
create policy pois_select on public.pois
  for select to authenticated using (true);
create policy pois_write on public.pois
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
