-- ───────────────────────────────────────────────────────────────────────────
-- 0021_pm_anchor_advancement.sql — Advance PM anchor when a sourced WO completes
--
-- Without this, pm_daily_run() re-generates the same work order the very next
-- day after it is completed: the open-WO guard only suppresses while the WO is
-- in a non-terminal status; once it's 'completed', open_count = 0 and the
-- engine sees next_due still in the past and fires again.
--
-- Fix: a BEFORE UPDATE (and INSERT) trigger on work_orders.  When a WO with
-- source_pm_id transitions into 'completed', compute the new anchor using the
-- same logic as advanceAnchor() in packages/shared/src/pm/engine.ts:
--   advance_from = 'completion'  → anchor = completed_date
--   advance_from = 'scheduled'   → anchor = scheduled_date  (calendar/fixed)
--                                           or completed_date (meter fallback)
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.advance_pm_anchor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sched      record;
  new_anchor date;
  comp_date  date;
begin
  -- Only act when transitioning into 'completed' with a linked PM schedule.
  if NEW.status <> 'completed' then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.status = 'completed' then
    return NEW;         -- already completed — ignore re-saves
  end if;
  if NEW.source_pm_id is null then
    return NEW;
  end if;

  select * into sched
  from  pm_schedules
  where id = NEW.source_pm_id and deleted_at is null;

  if not found then
    return NEW;
  end if;

  comp_date := coalesce(NEW.completed_date, current_date);

  if sched.advance_from = 'completion' then
    -- Anchor to the actual completion date — prevents drift-stacking.
    new_anchor := comp_date;

  else
    -- 'scheduled': anchor to the intended due date, not the actual completion.
    -- Calendar: anchor + one interval (same arithmetic as pm_daily_run).
    if sched.trigger_type = 'calendar'
       and sched.interval_value is not null
       and sched.interval_unit  is not null
    then
      new_anchor := (
        sched.anchor_date::date
        + (sched.interval_value::text || ' ' || sched.interval_unit::text)::interval
      )::date;

    -- Fixed-date: the scheduled_date set by pm_daily_run is the due date.
    elsif sched.trigger_type = 'fixed_date' then
      new_anchor := coalesce(NEW.scheduled_date, comp_date);

    -- Meter: no date-based "scheduled" concept; fall back to completion date.
    else
      new_anchor := comp_date;
    end if;
  end if;

  update pm_schedules
     set anchor_date = new_anchor,
         updated_at  = now()
   where id = sched.id;

  return NEW;
end;
$$;

-- Fires on status changes (UPDATE) and direct completed inserts (INSERT).
create trigger advance_pm_anchor_on_complete
  before insert or update of status on public.work_orders
  for each row
  execute function public.advance_pm_anchor();
