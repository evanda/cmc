-- ───────────────────────────────────────────────────────────────────────────
-- 0009_vendors_contacts.sql — Vendors, Service Contracts & Contacts (plan §4.5, §6)
--
-- vendors        — companies that do work (COI/contract expiry tracked, §3.7)
-- vendor_documents — contracts, COI, W-9 attached to a vendor
-- service_contracts — recurring services (garbage, pest, landscaping…)
-- contacts       — lighter directory (utilities, insurance agent, locksmith…)
-- Also links work_orders → vendors (plan §6 vendor_id).
-- ───────────────────────────────────────────────────────────────────────────
create table public.vendors (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  category        text,                 -- trade (HVAC, Plumbing, Landscaping…)
  contact_name    text,
  phone           text,
  email           text,
  address         text,
  rate            numeric(12, 2),       -- hourly / visit rate
  coi_expiry      date,                 -- certificate of insurance (plan §3.7)
  contract_expiry date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  deleted_at      timestamptz
);
create trigger vendors_set_updated_at
  before update on public.vendors for each row execute function public.set_updated_at();

create table public.vendor_documents (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references public.vendors (id) on delete cascade,
  kind       text,                      -- contract | coi | w9 | other
  url        text not null,
  label      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz
);
create index vendor_documents_vendor_id_idx on public.vendor_documents (vendor_id);
create trigger vendor_documents_set_updated_at
  before update on public.vendor_documents for each row execute function public.set_updated_at();

create table public.service_contracts (
  id                    uuid primary key default gen_random_uuid(),
  vendor_id             uuid references public.vendors (id) on delete set null,
  description           text not null,
  cadence               text,            -- e.g. 'weekly', 'monthly', 'quarterly'
  cost                  numeric(12, 2),
  period_unit           text,            -- 'month' | 'year' (cost period)
  start_date            date,
  end_date              date,
  renewal_reminder_days integer,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid default auth.uid(),
  deleted_at            timestamptz
);
create index service_contracts_vendor_id_idx on public.service_contracts (vendor_id);
create trigger service_contracts_set_updated_at
  before update on public.service_contracts for each row execute function public.set_updated_at();

create table public.contacts (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  org            text,
  role           text,
  phone          text,
  email          text,
  account_number text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  deleted_at     timestamptz
);
create trigger contacts_set_updated_at
  before update on public.contacts for each row execute function public.set_updated_at();

-- Link work orders to a vendor record (plan §6).
alter table public.work_orders
  add column if not exists vendor_id uuid references public.vendors (id) on delete set null;

-- ── RLS (plan §7.5): read for authenticated; staff (admin/technician) writes ──
alter table public.vendors           enable row level security;
alter table public.vendor_documents  enable row level security;
alter table public.service_contracts enable row level security;
alter table public.contacts          enable row level security;

create policy vendors_select on public.vendors
  for select to authenticated using (true);
create policy vendors_write on public.vendors
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy vendor_documents_select on public.vendor_documents
  for select to authenticated using (true);
create policy vendor_documents_write on public.vendor_documents
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy service_contracts_select on public.service_contracts
  for select to authenticated using (true);
create policy service_contracts_write on public.service_contracts
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy contacts_select on public.contacts
  for select to authenticated using (true);
create policy contacts_write on public.contacts
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
