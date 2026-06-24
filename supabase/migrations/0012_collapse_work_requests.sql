-- 0012_collapse_work_requests.sql
-- Collapse the separate work-request intake into work_orders.
--
-- Rationale: for a single-tenant, trusted-team deployment the request→WO
-- conversion was an extra step with no payoff (everyone with access is staff;
-- every reported item is legitimate). The work_order lifecycle already starts
-- with a 'requested' status (migration 0004), so intake is just a work_order
-- created in that status, and triage is an in-place status change
-- (requested → open to accept, → cancelled to decline). No second table, no
-- convert-and-duplicate hop.
--
-- This migration:
--   1. Lets requesters INSERT work_orders, but only as clean 'requested' rows
--      (a BEFORE INSERT guard strips cost/assignee/schedule fields so a
--      requester can't inject money or assignments — the protection the
--      separate lightweight table used to give for free).
--   2. Scopes work_order reads: requesters see only their own; admin /
--      technician / trustee see all (tightens the prior `using (true)`).
--   3. Drops work_orders.source_request_id, the work_requests table, and the
--      work_request_status enum.

-- ── 1. Requester intake guard ────────────────────────────────────────────────
-- For non-staff inserts, force a costless, unassigned, untriaged request.
create or replace function public.work_orders_requester_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    new.status                 := 'requested';
    new.requested_by           := auth.uid();
    new.type                   := coalesce(new.type, 'reactive');
    new.priority               := coalesce(new.priority, 'medium');
    -- Strip everything a requester must not set:
    new.assignee_user_id       := null;
    new.coordinated_by_user_id := null;
    new.authorized_by_user_id  := null;
    new.vendor_name            := null;
    new.estimate_cost          := null;
    new.actual_parts_cost      := null;
    new.actual_labor_cost      := null;
    new.actual_vendor_cost     := null;
    new.labor_hours            := null;
    new.invoice_number         := null;
    new.invoice_url            := null;
    new.payment_reference      := null;
    new.scheduled_date         := null;
    new.due_date               := null;
    new.completed_date         := null;
    new.completion_notes       := null;
  end if;
  return new;
end;
$$;

drop trigger if exists work_orders_requester_guard_ins on public.work_orders;
create trigger work_orders_requester_guard_ins
  before insert on public.work_orders
  for each row execute function public.work_orders_requester_guard();

-- ── 2. RLS: requester-scoped reads + requester intake inserts ─────────────────
-- Reads: requesters see only their own; admin/technician/trustee see all.
drop policy if exists work_orders_select on public.work_orders;
create policy work_orders_select on public.work_orders
  for select to authenticated
  using (public.current_app_role() <> 'requester' or requested_by = auth.uid());

-- Inserts: requesters may file a request (the guard above forces it clean).
-- Staff insert/update/delete remains covered by the existing work_orders_write.
drop policy if exists work_orders_requester_insert on public.work_orders;
create policy work_orders_requester_insert on public.work_orders
  for insert to authenticated
  with check (
    public.current_app_role() = 'requester'
    and requested_by = auth.uid()
    and status = 'requested'
  );

-- ── 3. Drop the old request machinery ────────────────────────────────────────
alter table public.work_orders drop column if exists source_request_id;
drop table if exists public.work_requests;
drop type if exists public.work_request_status;
