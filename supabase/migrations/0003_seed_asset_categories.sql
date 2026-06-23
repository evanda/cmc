-- ───────────────────────────────────────────────────────────────────────────
-- 0003_seed_asset_categories.sql — default asset category template (plan §4.1)
--
-- Church-agnostic defaults (plan §7.6): seeded into every deployment so a new
-- church isn't staring at a blank slate. Idempotent (safe to re-run / re-reset).
-- ───────────────────────────────────────────────────────────────────────────
insert into public.asset_categories (name)
select v.name
from (
  values
    ('HVAC'),
    ('Roofing'),
    ('Plumbing'),
    ('Electrical'),
    ('Doors/Access'),
    ('Windows'),
    ('Lighting'),
    ('Fixtures'),
    ('Flooring/Carpet'),
    ('Paint/Walls'),
    ('Restrooms'),
    ('Network/IT'),
    ('Sound/AV'),
    ('Grounds/Playground'),
    ('Vehicles/Fleet'),
    ('Tools/Equipment'),
    ('Utility/Infrastructure'),
    ('Cemetery')
) as v (name)
where not exists (
  select 1 from public.asset_categories ac where ac.name = v.name
);
