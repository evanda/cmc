-- ───────────────────────────────────────────────────────────────────────────
-- 0019_pois_rls_admin_only.sql — tighten POI write access (plan §7.5, #49)
--
-- Previously: admin and technician (is_staff) could write POIs.
-- Now: only admin may insert/update/delete POIs — geometry editing is an
-- admin-only operation (Technicians and below get read-only map access).
-- The Loader tool (apps/loader) is already admin-gated at the app layer;
-- this migration enforces the same boundary at the DB level.
-- ───────────────────────────────────────────────────────────────────────────
drop policy if exists pois_write on public.pois;

create policy pois_write on public.pois
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
