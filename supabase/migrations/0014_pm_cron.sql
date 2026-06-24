-- ───────────────────────────────────────────────────────────────────────────
-- 0014_pm_cron.sql — Daily PM scheduling job (plan §4.3, §7.4)
--
-- Creates:
--   • public.pm_daily_run()  — PL/pgSQL function that generates work orders
--     for any active PM schedule whose next-due date falls within its lead
--     window.  Implements the same logic as packages/shared/src/pm/engine.ts
--     (nextDueDate + shouldGenerateWorkOrder) in SQL so the job runs inside
--     the DB without an external HTTP call.
--   • A pg_cron job that calls pm_daily_run() at 06:00 UTC every day.
--
-- Also patches work_orders_requester_guard to allow system/service-role
-- inserts (auth.uid() IS NULL) so the cron job can create clean WOs without
-- the guard stripping its fields.
--
-- Prerequisites in Supabase Cloud:
--   Dashboard → Database → Extensions → pg_cron (enable) + pg_net (enable).
-- For local dev: `supabase start` enables both automatically.
-- ───────────────────────────────────────────────────────────────────────────

-- ── 1. Allow system/service-role inserts through the requester guard ─────────
-- The guard was written assuming every insert comes from an authenticated user.
-- When pm_daily_run() (SECURITY DEFINER, no JWT) inserts a work order,
-- auth.uid() is NULL — which previously made is_staff() return false and
-- stripped all fields.  Now: null uid → system call → pass through unchanged.
create or replace function public.work_orders_requester_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- System/service-role calls have no JWT → treat as authorised staff.
  if auth.uid() is null then
    return new;
  end if;
  if not public.is_staff() then
    new.status                 := 'requested';
    new.requested_by           := auth.uid();
    new.type                   := coalesce(new.type, 'reactive');
    new.priority               := coalesce(new.priority, 'medium');
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

-- ── 2. pm_daily_run() — the scheduling engine in SQL ────────────────────────
create or replace function public.pm_daily_run()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sched        record;
  due_dt       date;
  days_until   int;
  open_count   int;
  generated    int := 0;
  skipped      int := 0;
begin
  for sched in
    select
      s.*,
      t.name         as task_name,
      t.instructions as task_instructions
    from  pm_schedules  s
    left  join task_templates t on t.id = s.task_template_id
    where s.active     = true
      and s.deleted_at is null
  loop
    -- Skip if a non-terminal WO already exists for this cycle (plan §4.3).
    select count(*) into open_count
    from  work_orders
    where source_pm_id = sched.id
      and status in ('open', 'in_progress', 'on_hold')
      and deleted_at  is null;

    if open_count > 0 then
      skipped := skipped + 1;
      continue;
    end if;

    -- ── Calendar trigger ─────────────────────────────────────────────────────
    if sched.trigger_type = 'calendar'
       and sched.interval_value is not null
       and sched.interval_unit  is not null
    then
      -- next_due = anchor + one interval (matches nextDueDate() in engine.ts)
      due_dt := (
        sched.anchor_date::date
        + (sched.interval_value::text || ' ' || sched.interval_unit::text)::interval
      )::date;
      days_until := due_dt - current_date;

      if days_until <= sched.lead_time_days then
        insert into work_orders (
          title,   description,   type,         priority,  status,
          source_pm_id,           linked_asset_id,         location_id,
          assignee_user_id,       vendor_id,
          scheduled_date,         due_date
        ) values (
          coalesce(sched.task_name, sched.name),
          sched.task_instructions,
          'preventive',           'medium',      'open',
          sched.id,               sched.asset_id,          sched.location_id,
          sched.assignee_user_id, sched.vendor_id,
          due_dt,                 due_dt
        );
        generated := generated + 1;
      end if;

    -- ── Fixed-date trigger ───────────────────────────────────────────────────
    elsif sched.trigger_type = 'fixed_date'
          and sched.fixed_month is not null
          and sched.fixed_day   is not null
    then
      -- Next occurrence of the fixed month/day strictly after today
      due_dt := make_date(
        extract(year from current_date)::int,
        sched.fixed_month,
        sched.fixed_day
      );
      if due_dt <= current_date then
        due_dt := make_date(
          extract(year from current_date)::int + 1,
          sched.fixed_month,
          sched.fixed_day
        );
      end if;
      days_until := due_dt - current_date;

      if days_until <= sched.lead_time_days then
        insert into work_orders (
          title,   description,   type,         priority,  status,
          source_pm_id,           linked_asset_id,         location_id,
          assignee_user_id,       vendor_id,
          scheduled_date,         due_date
        ) values (
          coalesce(sched.task_name, sched.name),
          sched.task_instructions,
          'preventive',           'medium',      'open',
          sched.id,               sched.asset_id,          sched.location_id,
          sched.assignee_user_id, sched.vendor_id,
          due_dt,                 due_dt
        );
        generated := generated + 1;
      end if;

    -- ── Meter trigger ────────────────────────────────────────────────────────
    -- Server-side meter checks require the latest reading per meter, which
    -- changes continuously.  The UI already surfaces overdue meter PMs on the
    -- PM Schedules page via meterUnitsRemaining() (engine.ts).  A full
    -- server-side sweep (latest reading JOIN pm_schedules) can be added here
    -- once meter readings flow reliably from the app or an IoT feed.
    end if;

  end loop;

  return jsonb_build_object(
    'generated', generated,
    'skipped',   skipped,
    'ran_at',    now()
  );
end;
$$;

-- ── 3. pg_cron: schedule pm_daily_run() at 06:00 UTC every day ──────────────
-- Requires pg_cron to be enabled (Supabase Dashboard → Extensions → pg_cron).
-- Safe to run even if pg_cron is not yet enabled — the extension block below
-- will fail gracefully and the cron.schedule() call is idempotent on re-run.
create extension if not exists pg_cron with schema extensions;

-- Remove any prior schedule so this migration is re-runnable.
select cron.unschedule('pm-daily-run') where exists (
  select 1 from cron.job where jobname = 'pm-daily-run'
);

select cron.schedule(
  'pm-daily-run',          -- job name
  '0 6 * * *',             -- 06:00 UTC daily
  'select public.pm_daily_run();'
);
