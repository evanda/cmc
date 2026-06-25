-- Floor boundary polygon (plan §5, complex shapes).
-- geo_corners_geojson remains the 4-point quad for MapLibre image-source overlays.
-- boundary_geojson is the actual floor outline — any Polygon, no corner limit.
alter table public.floors
  add column if not exists boundary_geojson jsonb;
