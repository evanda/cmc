-- ───────────────────────────────────────────────────────────────────────────
-- 0001_schema.sql — Phase 0 foundation schema (plan §6, the schema source of truth)
--
-- Scope: single-tenant per deployment (plan §7.6) — NO facility_id is threaded
-- through tables; church identity is the single org_settings row + seed only.
-- Tables here: org_settings, users, buildings, floors, locations,
-- asset_categories, assets. Later phases add work orders, PMs, vendors, POIs, …
-- ───────────────────────────────────────────────────────────────────────────

-- gen_random_uuid() is built into Postgres core (13+); pgcrypto kept for parity.
create extension if not exists pgcrypto;

-- ── Enums (mirrored in packages/shared/src/types/enums.ts) ───────────────────
create type public.user_role as enum ('admin', 'technician', 'requester', 'trustee', 'vendor');
create type public.criticality as enum ('low', 'medium', 'high');
create type public.asset_status as enum ('active', 'retired');

-- ── updated_at touch trigger ─────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── org_settings: single-row church identity / branding (plan §7.6) ──────────
-- The `singleton` column + unique check guarantees at most one row, so church
-- identity is data, never hardcoded.
create table public.org_settings (
  id            uuid primary key default gen_random_uuid(),
  singleton     boolean not null default true,
  facility_name text not null,
  logo_url      text,
  address       text,
  locale        text not null default 'en-US',
  distance_unit text not null default 'mi',
  currency      text not null default 'USD',
  timezone      text not null default 'America/New_York',
  theme         jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  deleted_at    timestamptz,
  constraint org_settings_singleton_chk check (singleton),
  constraint org_settings_singleton_uniq unique (singleton)
);
create trigger org_settings_set_updated_at
  before update on public.org_settings
  for each row execute function public.set_updated_at();

-- ── users: app profile + role, 1:1 with auth.users (plan §6, §7.5) ───────────
create table public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  email      text not null,
  role       public.user_role not null default 'requester',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- New auth signups get a profile row automatically (first admin is promoted by seed).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ── buildings / floors / locations (plan §6) ─────────────────────────────────
create table public.buildings (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description       text,
  address           text,
  footprint_geojson jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid default auth.uid(),
  deleted_at        timestamptz
);
create trigger buildings_set_updated_at
  before update on public.buildings
  for each row execute function public.set_updated_at();

create table public.floors (
  id                  uuid primary key default gen_random_uuid(),
  building_id         uuid not null references public.buildings (id) on delete cascade,
  name                text not null,
  level               integer not null default 1,   -- -1 = B1, 0/1 = ground, 2… (plan §5.2)
  floorplan_image_url text,
  geo_corners_geojson jsonb,
  rotation_deg        numeric,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  deleted_at          timestamptz,
  constraint floors_building_level_uniq unique (building_id, level)
);
create index floors_building_id_idx on public.floors (building_id);
create trigger floors_set_updated_at
  before update on public.floors
  for each row execute function public.set_updated_at();

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  floor_id    uuid references public.floors (id) on delete set null,
  name        text not null,
  type        text,                                  -- room | area | … (plan §6)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz
);
create index locations_building_id_idx on public.locations (building_id);
create index locations_floor_id_idx on public.locations (floor_id);
create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- ── asset_categories / assets (plan §4.1, §6) ────────────────────────────────
create table public.asset_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  parent_id  uuid references public.asset_categories (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);
create trigger asset_categories_set_updated_at
  before update on public.asset_categories
  for each row execute function public.set_updated_at();

create table public.assets (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  category_id         uuid references public.asset_categories (id) on delete set null,
  parent_asset_id     uuid references public.assets (id) on delete set null,
  location_id         uuid references public.locations (id) on delete set null,
  make                text,
  model               text,
  serial              text,
  install_date        date,
  purchase_cost       numeric(12, 2),
  expected_life_years integer,
  replacement_cost    numeric(12, 2),
  warranty_expiry     date,
  criticality         public.criticality not null default 'low',
  status              public.asset_status not null default 'active',
  qr_token            text unique,                   -- nullable slug for QR deep links (plan §3)
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  deleted_at          timestamptz
);
create index assets_category_id_idx on public.assets (category_id);
create index assets_location_id_idx on public.assets (location_id);
create index assets_parent_asset_id_idx on public.assets (parent_asset_id);
create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();
