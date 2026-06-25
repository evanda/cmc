-- ───────────────────────────────────────────────────────────────────────────
-- 0019_poi_rls_admin_only.sql — tighten POI write access (plan §7.5, #49)
--
-- Per the role matrix in #49: only Admins may add, delete, or reposition POIs.
-- All geometry editing lives in the Loader tool (apps/loader) which is already
-- admin-gated. Technicians retain read access and can file WOs from the map
-- but cannot modify POI records in the main app or via the API.
-- ───────────────────────────────────────────────────────────────────────────
drop policy if exists pois_write on public.pois;

create policy pois_write on public.pois
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
