-- ─────────────────────────────────────────────────────────────────────────
-- Local-stack seed (runs automatically after migrations on `supabase db reset`;
-- NOT pushed to a remote by `supabase db push`).
--
-- Why this exists: migrations create tables as role `postgres`. Recent Supabase
-- ships a restrictive default ACL (FOR ROLE postgres, schema public) that grants
-- the API roles only TRUNCATE/REFERENCES/TRIGGER — NOT INSERT/SELECT/UPDATE/DELETE.
-- So on a *fresh* database every table is invisible to PostgREST (and the
-- service-role seed client) until DML is granted. All public tables here have
-- RLS enabled (20/20), so granting broad base DML is safe — RLS does the actual
-- per-row gating. This is the standard Supabase "grant broad, restrict with RLS"
-- model. (Migration 0016 already does this for `vehicles`; this covers the rest
-- for local dev.)
--
-- NOTE: a fresh *cloud* deployment (plan §7.6 "hand it to a friend") hits the
-- same wall, since `db push` does not run this file. If/when that matters,
-- promote these grants into a real migration.
-- ─────────────────────────────────────────────────────────────────────────

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

-- Cover tables created by future migrations too (same restrictive-default cause).
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- Default local admin (LOCAL DEV ONLY).
--
-- A fresh stack has an empty auth.users, and the app's on_auth_user_created
-- trigger only ever creates `requester`-role profiles — while migration 0015
-- blocks self-promotion to admin. So a brand-new local DB has no way to reach
-- an admin through the UI. This seeds one.
--
--   email:    admin@admin.com   (the login form is type="email", so it needs
--                                an @-address; this is the simplest one)
--   password: admin
--
-- Safe to hardcode: this file never reaches a remote (`supabase db push` does
-- not run seed.sql). The empty-string token columns are required — GoTrue
-- errors with "Database error querying schema" if they're NULL.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare uid uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = 'admin@admin.com') then
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new,
    email_change, phone_change, phone_change_token,
    email_change_token_current, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid,
    'authenticated', 'authenticated', 'admin@admin.com',
    extensions.crypt('admin', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Local Admin"}'::jsonb, false,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', 'admin@admin.com'),
    'email', now(), now(), now()
  );

  -- the on_auth_user_created trigger already inserted a public.users row
  -- (default role 'requester'); promote it to admin.
  update public.users set role = 'admin', name = 'Local Admin' where id = uid;
end $$;
