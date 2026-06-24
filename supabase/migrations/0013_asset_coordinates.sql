-- ───────────────────────────────────────────────────────────────────────────
-- 0013_asset_coordinates.sql — intrinsic map coordinates for fixed assets
-- (plan §5.4; issues #38, #37)
--
-- Many assets never move: AC units, thermostats, AEDs, shutoffs, panels. Rather
-- than forcing a shadow `pois` row per fixed asset just to place it on the map,
-- an asset can carry its own point geometry + level directly. Both columns are
-- nullable — mobile/tool assets (leaf blower, ladders) simply leave them null.
--
-- Read path needs no app change: listAssets/getAsset already `select('*')`.
-- Writes set these via the loader/seed, not the hand-edited asset form, so the
-- normal "edit asset" flow can't accidentally clear a placement.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.assets
  add column geometry_geojson jsonb,    -- GeoJSON Point (lng/lat); null = unplaced
  add column level            integer;  -- floor: -1=B1, 0/1=ground, 2…; null = unplaced/site

create index assets_level_idx on public.assets (level);
