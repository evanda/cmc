-- ───────────────────────────────────────────────────────────────────────────
-- 0016_vehicles.sql — Fleet / Vehicle profile table (plan §4.4, §6)
--
-- The 3 buses (and any future vehicles) live as `assets` in the asset registry.
-- This table extends an asset with vehicle-specific fields: VIN, plate, expiry
-- dates for registration / insurance / state inspection, and an optional link
-- to the driver's contact record.  The daily expiry sweep (check-expiries.ts)
-- surfaces vehicle renewals on the Expiry Board alongside warranties/COIs.
-- ───────────────────────────────────────────────────────────────────────────

create table public.vehicles (
  id                   uuid primary key default gen_random_uuid(),
  asset_id             uuid not null references public.assets (id) on delete cascade,
  vin                  text,
  plate                text,
  year                 smallint,
  make                 text,
  model                text,
  fuel_type            text,
  capacity             smallint,
  registration_expiry  date,
  insurance_expiry     date,
  inspection_expiry    date,
  driver_contact_id    uuid references public.contacts (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references public.users (id) on delete set null,
  deleted_at           timestamptz
);

-- One vehicle profile per asset (soft-delete-aware).
create unique index vehicles_asset_id_idx
  on public.vehicles (asset_id)
  where deleted_at is null;

create trigger vehicles_set_updated_at
  before update on public.vehicles for each row
  execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.vehicles enable row level security;

-- All authenticated users can read.
create policy vehicles_select on public.vehicles
  for select to authenticated using (true);

-- Only staff (admin / technician) can create, update, or delete.
create policy vehicles_write on public.vehicles
  for all using (public.is_staff()) with check (public.is_staff());

-- Grant DML to the authenticated role so Supabase auto-RLS applies.
grant select, insert, update, delete on public.vehicles to authenticated;
