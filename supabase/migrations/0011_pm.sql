-- ───────────────────────────────────────────────────────────────────────────
-- 0011_pm.sql — Preventive Maintenance scheduling (plan §4.3, §6)
--
-- pm_schedules drive the engine (packages/shared/src/pm/engine.ts): a trigger
-- (calendar / meter / fixed date), an anchor, a lead time, and where the work
-- lands. task_templates describe the work; meters + meter_readings feed
-- meter-based triggers.
-- ───────────────────────────────────────────────────────────────────────────
create type public.pm_trigger_type as enum ('calendar', 'meter', 'fixed_date');
create type public.pm_interval_unit as enum ('day', 'week', 'month', 'year');
create type public.pm_advance_from as enum ('completion', 'scheduled');

create table public.task_templates (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  instructions          text,
  checklist_template_id uuid,                    -- FK added with the checklists module
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid default auth.uid(),
  deleted_at            timestamptz
);
create trigger task_templates_set_updated_at
  before update on public.task_templates for each row execute function public.set_updated_at();

create table public.meters (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references public.assets (id) on delete cascade,
  type       text not null,                      -- odometer | run_hours | …
  unit       text not null,                      -- mi | km | hours
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);
create index meters_asset_id_idx on public.meters (asset_id);
create trigger meters_set_updated_at
  before update on public.meters for each row execute function public.set_updated_at();

create table public.meter_readings (
  id           uuid primary key default gen_random_uuid(),
  meter_id     uuid not null references public.meters (id) on delete cascade,
  value        numeric(14, 2) not null,
  reading_date date not null default current_date,
  recorded_by  uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  deleted_at   timestamptz
);
create index meter_readings_meter_id_idx on public.meter_readings (meter_id);
create trigger meter_readings_set_updated_at
  before update on public.meter_readings for each row execute function public.set_updated_at();

create table public.pm_schedules (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  asset_id         uuid references public.assets (id) on delete cascade,
  location_id      uuid references public.locations (id) on delete set null,
  task_template_id uuid references public.task_templates (id) on delete set null,
  trigger_type     public.pm_trigger_type not null default 'calendar',
  interval_value   integer,
  interval_unit    public.pm_interval_unit,
  fixed_month      integer,                       -- fixed_date: 1–12
  fixed_day        integer,                       -- fixed_date: 1–31
  meter_id         uuid references public.meters (id) on delete set null,
  meter_threshold  numeric(14, 2),
  anchor_date      date not null default current_date,
  advance_from     public.pm_advance_from not null default 'completion',
  lead_time_days   integer not null default 14,
  assignee_user_id uuid references public.users (id) on delete set null,
  vendor_id        uuid references public.vendors (id) on delete set null,
  is_compliance    boolean not null default false,
  category         text,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  deleted_at       timestamptz
);
create index pm_schedules_asset_id_idx on public.pm_schedules (asset_id);
create index pm_schedules_active_idx on public.pm_schedules (active);
create trigger pm_schedules_set_updated_at
  before update on public.pm_schedules for each row execute function public.set_updated_at();

-- The PM engine spawns work orders; record which schedule produced one (plan §6).
alter table public.work_orders
  add column if not exists source_pm_id uuid references public.pm_schedules (id) on delete set null;

-- ── RLS (plan §7.5): read for authenticated; staff writes; techs log readings ─
alter table public.task_templates enable row level security;
alter table public.meters         enable row level security;
alter table public.meter_readings enable row level security;
alter table public.pm_schedules   enable row level security;

create policy task_templates_select on public.task_templates
  for select to authenticated using (true);
create policy task_templates_write on public.task_templates
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy meters_select on public.meters
  for select to authenticated using (true);
create policy meters_write on public.meters
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy meter_readings_select on public.meter_readings
  for select to authenticated using (true);
create policy meter_readings_write on public.meter_readings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy pm_schedules_select on public.pm_schedules
  for select to authenticated using (true);
create policy pm_schedules_write on public.pm_schedules
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
