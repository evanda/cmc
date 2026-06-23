-- ───────────────────────────────────────────────────────────────────────────
-- 0002_rls.sql — Row-Level Security & role helpers (plan §7.5)
--
-- Roles: admin (full), technician (manage assets/work), requester & trustee
-- (read-only in Phase 0; cost visibility differs later), vendor (deferred).
-- Config tables (org_settings, buildings, floors, locations, asset_categories)
-- are admin-writable; assets are admin/technician-writable. All authenticated
-- users may read. Anonymous (logged-out) users get nothing.
-- ───────────────────────────────────────────────────────────────────────────

-- Role lookups run as SECURITY DEFINER to avoid recursive RLS on public.users.
create or replace function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

-- Staff = admin or technician (may manage the asset registry).
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'technician'), false);
$$;

-- Enable RLS everywhere.
alter table public.org_settings     enable row level security;
alter table public.users            enable row level security;
alter table public.buildings        enable row level security;
alter table public.floors           enable row level security;
alter table public.locations        enable row level security;
alter table public.asset_categories enable row level security;
alter table public.assets           enable row level security;

-- ── org_settings: everyone reads church identity; admin writes ───────────────
create policy org_settings_select on public.org_settings
  for select to authenticated using (true);
create policy org_settings_write on public.org_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── users: read all (assignee pickers); update own name; admin manages all ───
create policy users_select on public.users
  for select to authenticated using (true);
create policy users_update_self on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy users_admin_write on public.users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── buildings / floors / locations / asset_categories: read all, admin writes ─
create policy buildings_select on public.buildings
  for select to authenticated using (true);
create policy buildings_write on public.buildings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy floors_select on public.floors
  for select to authenticated using (true);
create policy floors_write on public.floors
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy locations_select on public.locations
  for select to authenticated using (true);
create policy locations_write on public.locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy asset_categories_select on public.asset_categories
  for select to authenticated using (true);
create policy asset_categories_write on public.asset_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── assets: read all; admin or technician writes (plan §7.5) ─────────────────
create policy assets_select on public.assets
  for select to authenticated using (true);
create policy assets_write on public.assets
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
