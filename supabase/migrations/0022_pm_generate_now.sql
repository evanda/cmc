-- ───────────────────────────────────────────────────────────────────────────
-- 0022_pm_generate_now.sql — Manual trigger for the PM engine (plan §4.3)
--
-- The daily pg_cron job (0014) runs pm_daily_run() at 06:00 UTC. This adds a
-- staff-callable RPC wrapper so admins/technicians can generate due work
-- orders on demand — for testing, or to catch up before the next nightly run —
-- from the app (Assets → Maintenance Schedules → "Generate due work orders").
--
-- Reuses pm_daily_run() unchanged. The wrapper enforces is_staff(); the cron
-- path keeps calling pm_daily_run() directly with a null JWT, so it is
-- unaffected by this check.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.pm_generate_now()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff (admin/technician) can generate work orders';
  end if;
  return public.pm_daily_run();
end;
$$;

revoke all on function public.pm_generate_now() from public;
grant execute on function public.pm_generate_now() to authenticated;
