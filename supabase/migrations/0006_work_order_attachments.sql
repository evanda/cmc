-- ───────────────────────────────────────────────────────────────────────────
-- 0006_work_order_attachments.sql — before/after photos on work orders (§4.2, §6)
--
-- `kind` distinguishes 'before' (damage, captured when the WO is created) from
-- 'after' (proof of repair, captured when it's closed). 'document' is reserved
-- for later (manuals, permits, vendor PDFs).
-- ───────────────────────────────────────────────────────────────────────────
create table public.work_order_attachments (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  url           text not null,
  kind          text not null default 'after',   -- 'before' | 'after' | 'document'
  caption       text,
  taken_at      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  deleted_at    timestamptz,
  constraint work_order_attachments_kind_chk
    check (kind in ('before', 'after', 'document'))
);
create index work_order_attachments_wo_id_idx on public.work_order_attachments (work_order_id);
create trigger work_order_attachments_set_updated_at
  before update on public.work_order_attachments
  for each row execute function public.set_updated_at();

-- RLS (plan §7.5): read for authenticated; staff (admin/technician) writes.
alter table public.work_order_attachments enable row level security;
create policy work_order_attachments_select on public.work_order_attachments
  for select to authenticated using (true);
create policy work_order_attachments_write on public.work_order_attachments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
