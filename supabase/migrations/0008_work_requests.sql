-- ───────────────────────────────────────────────────────────────────────────
-- 0008_work_requests.sql — Work Request intake (plan §3.1, §4.2, §6)
--
-- Any staff/volunteer can submit a raw request ("AC out in Room 12"); staff
-- triage it into a work order. Keeps the WO list clean and gives requesters
-- status visibility without edit rights.
-- ───────────────────────────────────────────────────────────────────────────
create type public.work_request_status as enum ('open', 'converted', 'declined');

create table public.work_requests (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  requested_by    uuid references public.users (id) on delete set null default auth.uid(),
  location_id     uuid references public.locations (id) on delete set null,
  linked_asset_id uuid references public.assets (id) on delete set null,
  status          public.work_request_status not null default 'open',
  photo_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  deleted_at      timestamptz
);
create index work_requests_status_idx on public.work_requests (status);
create trigger work_requests_set_updated_at
  before update on public.work_requests
  for each row execute function public.set_updated_at();

-- A converted request links to the WO it spawned (plan §6 source_request_id).
alter table public.work_orders
  add column if not exists source_request_id uuid references public.work_requests (id) on delete set null;

-- ── RLS (plan §7.5) ──────────────────────────────────────────────────────────
-- Requesters submit and see their own; staff see/triage all.
alter table public.work_requests enable row level security;

create policy work_requests_select on public.work_requests
  for select to authenticated
  using (public.is_staff() or requested_by = auth.uid());

create policy work_requests_insert on public.work_requests
  for insert to authenticated
  with check (requested_by = auth.uid() or public.is_staff());

create policy work_requests_staff_write on public.work_requests
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy work_requests_staff_delete on public.work_requests
  for delete to authenticated
  using (public.is_staff());
