-- ───────────────────────────────────────────────────────────────────────────
-- 0004_asset_history_photos_contacts.sql — Phase 1 (plan §4.1, §4.2, §4.7)
--
-- Adds, around the asset registry:
--   • per-asset point of contact + an org-wide maintenance contact fallback
--   • asset_photos (multiple per asset, one primary)
--   • work_orders = the asset's service history (what/when/cost, who did it,
--     who coordinated, who authorized, invoice #, check/payment #)
-- ───────────────────────────────────────────────────────────────────────────

-- ── point of contact ─────────────────────────────────────────────────────────
-- Org-wide default (a mail list like maintenance@example.org). Per-asset
-- overrides below; the UI falls back to this when an asset has none.
alter table public.org_settings add column if not exists maintenance_contact_email text;

alter table public.assets add column if not exists contact_name text;
alter table public.assets add column if not exists contact_email text;

-- ── asset_photos (plan §6) ───────────────────────────────────────────────────
create table public.asset_photos (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references public.assets (id) on delete cascade,
  url        text not null,
  caption    text,
  is_primary boolean not null default false,
  taken_at   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);
create index asset_photos_asset_id_idx on public.asset_photos (asset_id);
-- At most one primary photo per asset.
create unique index asset_photos_one_primary_idx
  on public.asset_photos (asset_id)
  where is_primary and deleted_at is null;
create trigger asset_photos_set_updated_at
  before update on public.asset_photos
  for each row execute function public.set_updated_at();

-- ── work_orders = asset service history (plan §4.2, §6) ───────────────────────
create type public.work_order_type as enum ('reactive', 'preventive', 'inspection');
create type public.work_order_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.work_order_status as enum (
  'requested', 'open', 'in_progress', 'on_hold', 'completed', 'closed', 'cancelled'
);

create table public.work_orders (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null,
  description            text,
  type                   public.work_order_type not null default 'reactive',
  priority               public.work_order_priority not null default 'medium',
  status                 public.work_order_status not null default 'open',
  linked_asset_id        uuid references public.assets (id) on delete cascade,
  location_id            uuid references public.locations (id) on delete set null,
  -- People (plan: "by whom, who coordinated, who authorized")
  requested_by           uuid references public.users (id) on delete set null,
  assignee_user_id       uuid references public.users (id) on delete set null,
  coordinated_by_user_id uuid references public.users (id) on delete set null,
  authorized_by_user_id  uuid references public.users (id) on delete set null,
  vendor_name            text,                       -- external performer until the vendors module (Phase 1 later)
  -- Money (plan §4.7 — estimate vs actual, kept light)
  estimate_cost          numeric(12, 2),
  actual_parts_cost      numeric(12, 2),
  actual_labor_cost      numeric(12, 2),
  actual_vendor_cost     numeric(12, 2),
  labor_hours            numeric(8, 2),
  -- Paper trail
  invoice_number         text,
  invoice_url            text,
  payment_reference      text,                       -- check / payment #
  -- Dates
  scheduled_date         date,
  due_date               date,
  completed_date         date,
  completion_notes       text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid default auth.uid(),
  deleted_at             timestamptz
);
create index work_orders_linked_asset_id_idx on public.work_orders (linked_asset_id);
create index work_orders_status_idx on public.work_orders (status);
create trigger work_orders_set_updated_at
  before update on public.work_orders
  for each row execute function public.set_updated_at();

-- ── RLS (plan §7.5): read for authenticated; staff (admin/technician) writes ──
alter table public.asset_photos enable row level security;
alter table public.work_orders  enable row level security;

create policy asset_photos_select on public.asset_photos
  for select to authenticated using (true);
create policy asset_photos_write on public.asset_photos
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy work_orders_select on public.work_orders
  for select to authenticated using (true);
create policy work_orders_write on public.work_orders
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
