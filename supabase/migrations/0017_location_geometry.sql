-- Add a point geometry to locations so rooms/areas can be placed on the map.
-- Mirrors the assets.geometry_geojson + assets.level pattern (0013_asset_coordinates.sql).
alter table public.locations
  add column if not exists geometry_geojson jsonb,
  add column if not exists level            integer;
