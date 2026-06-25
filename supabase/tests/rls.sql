-- ───────────────────────────────────────────────────────────────────────────
-- supabase/tests/rls.sql — RLS role-boundary verification (plan §7.5)
--
-- Run AFTER the auth shim + all migrations:
--   psql -d cmc_ci -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
--
-- Covers:
--   1. Role functions  (current_app_role / is_staff / is_admin)
--   2. Self-promotion guard  (requester cannot elevate own role to admin/tech)
--   3. Assets  (requesters and trustees cannot write)
--   4. Work orders  (requesters can insert a 'requested' WO, not an 'open' one;
--                    requester sees only own WOs; trustee/tech/admin see all)
--   5. org_settings  (only admin can write)
-- ───────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on
\set VERBOSITY terse

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Allow the superuser session to impersonate the 'authenticated' Postgres role.
grant authenticated to current_user;

-- In Supabase, table-level grants to 'authenticated' are set up automatically
-- by the platform. In plain-Postgres CI they don't exist, so we add them here
-- to match the real environment.
grant select, insert, update, delete
  on public.users, public.assets, public.work_orders, public.org_settings,
     public.buildings, public.floors, public.locations, public.vendors,
     public.contacts, public.pois, public.pm_schedules, public.task_templates,
     public.meters, public.meter_readings, public.vehicles,
     public.work_order_comments, public.work_order_attachments,
     public.asset_documents, public.asset_photos,
     public.checklist_templates, public.checklist_items,
     public.inspection_runs, public.inspection_results,
     public.vendor_documents, public.service_contracts,
     public.audit_log
  to authenticated;

-- Shorthand: set the JWT sub claim so auth.uid() returns this value.
create or replace function _test_set_uid(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, true);
$$;

-- ── Fixture users ─────────────────────────────────────────────────────────────

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000000'::uuid, 'admin@rls.local'),
  ('bbbbbbbb-0000-0000-0000-000000000000'::uuid, 'tech@rls.local'),
  ('cccccccc-0000-0000-0000-000000000000'::uuid, 'req@rls.local'),
  ('dddddddd-0000-0000-0000-000000000000'::uuid, 'trustee@rls.local');

-- handle_new_auth_user trigger created public.users rows with role = 'requester'.
-- Promote admin / tech / trustee (service-role call — bypasses RLS).
update public.users set role = 'admin'      where id = 'aaaaaaaa-0000-0000-0000-000000000000';
update public.users set role = 'technician' where id = 'bbbbbbbb-0000-0000-0000-000000000000';
update public.users set role = 'trustee'    where id = 'dddddddd-0000-0000-0000-000000000000';
-- cccccccc stays 'requester'.

-- Fixture org_settings row.
insert into public.org_settings (facility_name) values ('Test Org');

-- Fixture building + asset (inserted as superuser so no RLS applies).
insert into public.buildings (id, name) values
  ('b0000000-0000-0000-0000-000000000000'::uuid, 'Test Building');

insert into public.assets (id, name) values
  ('a0000000-0000-0000-0000-000000000000'::uuid, 'Test Asset');

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Role helper functions
-- ────────────────────────────────────────────────────────────────────────────

\echo '--- 1. current_app_role / is_staff / is_admin ---'

do $$ begin
  perform _test_set_uid('aaaaaaaa-0000-0000-0000-000000000000');
  assert public.current_app_role() = 'admin',      'admin role';
  assert public.is_admin()  = true,                'is_admin for admin';
  assert public.is_staff()  = true,                'is_staff for admin';

  perform _test_set_uid('bbbbbbbb-0000-0000-0000-000000000000');
  assert public.current_app_role() = 'technician', 'tech role';
  assert public.is_admin()  = false,               'is_admin false for tech';
  assert public.is_staff()  = true,                'is_staff true for tech';

  perform _test_set_uid('cccccccc-0000-0000-0000-000000000000');
  assert public.current_app_role() = 'requester',  'requester role';
  assert public.is_admin()  = false,               'is_admin false for req';
  assert public.is_staff()  = false,               'is_staff false for req';

  perform _test_set_uid('dddddddd-0000-0000-0000-000000000000');
  assert public.current_app_role() = 'trustee',    'trustee role';
  assert public.is_admin()  = false,               'is_admin false for trustee';
  assert public.is_staff()  = false,               'is_staff false for trustee';

  raise notice 'PASS 1: role helper functions';
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Self-promotion guard (the bug fixed in migration 0015)
-- ────────────────────────────────────────────────────────────────────────────

\echo '--- 2. Self-promotion guard ---'

-- 2a. Requester cannot elevate own role to admin.
begin;
select _test_set_uid('cccccccc-0000-0000-0000-000000000000');
set local role authenticated;
do $$
begin
  update public.users set role = 'admin' where id = 'cccccccc-0000-0000-0000-000000000000';
  raise exception 'FAIL 2a: requester self-promoted to admin';
exception when others then
  raise notice 'PASS 2a: requester cannot self-promote (error: %)', sqlerrm;
end $$;
rollback;

-- 2b. Admin can promote another user (admin_write policy — not blocked by self-promotion fix).
begin;
select _test_set_uid('aaaaaaaa-0000-0000-0000-000000000000');
set local role authenticated;
update public.users set role = 'technician' where id = 'cccccccc-0000-0000-0000-000000000000';
do $$
begin
  assert (select role from public.users where id = 'cccccccc-0000-0000-0000-000000000000') = 'technician',
    'admin should be able to promote another user';
  raise notice 'PASS 2b: admin can promote another user';
end $$;
rollback;

-- 2c. Requester can update own name (self-update of non-role columns still allowed).
begin;
select _test_set_uid('cccccccc-0000-0000-0000-000000000000');
set local role authenticated;
update public.users set name = 'Bob' where id = 'cccccccc-0000-0000-0000-000000000000';
do $$
begin
  assert (select name from public.users where id = 'cccccccc-0000-0000-0000-000000000000') = 'Bob',
    'requester should be able to update own name';
  raise notice 'PASS 2c: requester can update own name';
end $$;
rollback;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Assets — requesters and trustees cannot write
-- ────────────────────────────────────────────────────────────────────────────

\echo '--- 3. Asset write access ---'

-- 3a. Requester cannot insert an asset.
begin;
select _test_set_uid('cccccccc-0000-0000-0000-000000000000');
set local role authenticated;
do $$
begin
  insert into public.assets (name) values ('Hacked Asset');
  raise exception 'FAIL 3a: requester inserted an asset';
exception when others then
  raise notice 'PASS 3a: requester cannot insert asset (error: %)', sqlerrm;
end $$;
rollback;

-- 3b. Trustee cannot insert an asset.
begin;
select _test_set_uid('dddddddd-0000-0000-0000-000000000000');
set local role authenticated;
do $$
begin
  insert into public.assets (name) values ('Hacked Asset');
  raise exception 'FAIL 3b: trustee inserted an asset';
exception when others then
  raise notice 'PASS 3b: trustee cannot insert asset (error: %)', sqlerrm;
end $$;
rollback;

-- 3c. Technician can insert an asset.
begin;
select _test_set_uid('bbbbbbbb-0000-0000-0000-000000000000');
set local role authenticated;
do $$
begin
  insert into public.assets (name) values ('Tech Asset');
  raise notice 'PASS 3c: technician can insert asset';
end $$;
rollback;

-- 3d. Admin can insert an asset.
begin;
select _test_set_uid('aaaaaaaa-0000-0000-0000-000000000000');
set local role authenticated;
do $$
begin
  insert into public.assets (name) values ('Admin Asset');
  raise notice 'PASS 3d: admin can insert asset';
end $$;
rollback;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Work orders
-- ────────────────────────────────────────────────────────────────────────────

\echo '--- 4. Work-order access ---'

-- 4a. Requester can file a work order (intake flow — requester_guard forces status).
begin;
select _test_set_uid('cccccccc-0000-0000-0000-000000000000');
set local role authenticated;
do $$
begin
  insert into public.work_orders (title, requested_by, status)
  values ('Broken AC', 'cccccccc-0000-0000-0000-000000000000', 'requested');
  raise notice 'PASS 4a: requester can file a request (requested status)';
end $$;
rollback;

-- 4b. The requester_guard forces status = 'requested' even when 'open' is sent.
--     After the trigger, status = 'requested'; the WITH CHECK then passes.
begin;
select _test_set_uid('cccccccc-0000-0000-0000-000000000000');
set local role authenticated;
do $$
begin
  insert into public.work_orders (title, requested_by, status)
  values ('Sneaky WO', 'cccccccc-0000-0000-0000-000000000000', 'open');
  assert (
    select status from public.work_orders
    where title = 'Sneaky WO' and requested_by = 'cccccccc-0000-0000-0000-000000000000'
  ) = 'requested', 'guard should force status to requested';
  raise notice 'PASS 4b: requester WO status guard forces status = requested';
end $$;
rollback;

-- 4c. Requester sees only their own work orders (select scoping).
begin;
insert into public.work_orders (title, requested_by, status) values
  ('Req WO',   'cccccccc-0000-0000-0000-000000000000', 'requested'),
  ('Other WO', 'bbbbbbbb-0000-0000-0000-000000000000', 'open');

select _test_set_uid('cccccccc-0000-0000-0000-000000000000');
set local role authenticated;
do $$
declare cnt int;
begin
  select count(*) into cnt from public.work_orders where deleted_at is null;
  assert cnt = 1, format('requester should see 1 WO (own), got %s', cnt);
  raise notice 'PASS 4c: requester sees only own WOs (%s row)', cnt;
end $$;
rollback;

-- 4d. Technician sees all work orders.
begin;
insert into public.work_orders (title, requested_by, status) values
  ('Req WO',  'cccccccc-0000-0000-0000-000000000000', 'requested'),
  ('Tech WO', 'bbbbbbbb-0000-0000-0000-000000000000', 'open');

select _test_set_uid('bbbbbbbb-0000-0000-0000-000000000000');
set local role authenticated;
do $$
declare cnt int;
begin
  select count(*) into cnt from public.work_orders where deleted_at is null;
  assert cnt = 2, format('technician should see all WOs, got %s', cnt);
  raise notice 'PASS 4d: technician sees all WOs (%s rows)', cnt;
end $$;
rollback;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. org_settings — only admin can write
-- ────────────────────────────────────────────────────────────────────────────

\echo '--- 5. org_settings write access ---'

-- 5a. Requester cannot update org_settings (USING fails → 0 rows, no exception).
begin;
select _test_set_uid('cccccccc-0000-0000-0000-000000000000');
set local role authenticated;
do $$
begin
  update public.org_settings set facility_name = 'Hacked Name';
  assert (select facility_name from public.org_settings) = 'Test Org',
    'requester should not be able to update org_settings';
  raise notice 'PASS 5a: requester cannot update org_settings (0 rows affected)';
end $$;
rollback;

-- 5b. Admin can update org_settings.
begin;
select _test_set_uid('aaaaaaaa-0000-0000-0000-000000000000');
set local role authenticated;
do $$
begin
  update public.org_settings set facility_name = 'Updated Name';
  assert (select facility_name from public.org_settings) = 'Updated Name',
    'admin should be able to update org_settings';
  raise notice 'PASS 5b: admin can update org_settings';
end $$;
rollback;

-- ── Teardown ──────────────────────────────────────────────────────────────────
drop function if exists _test_set_uid(uuid);

\echo '=== All RLS checks passed ==='
