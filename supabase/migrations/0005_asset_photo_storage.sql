-- ───────────────────────────────────────────────────────────────────────────
-- 0005_asset_photo_storage.sql — Supabase Storage bucket for asset photos
--
-- Guarded so it is a no-op where the Supabase-managed `storage` schema doesn't
-- exist (e.g. the plain-Postgres migration check). On a real Supabase project it
-- creates a public read-only bucket; writes are gated to staff via storage RLS.
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema absent — skipping asset-photos bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('asset-photos', 'asset-photos', true)
  on conflict (id) do nothing;

  -- Public read; staff (admin/technician) write. Drop-then-create for idempotency.
  drop policy if exists asset_photos_read on storage.objects;
  create policy asset_photos_read on storage.objects
    for select using (bucket_id = 'asset-photos');

  drop policy if exists asset_photos_staff_write on storage.objects;
  create policy asset_photos_staff_write on storage.objects
    for all to authenticated
    using (bucket_id = 'asset-photos' and public.is_staff())
    with check (bucket_id = 'asset-photos' and public.is_staff());
end $$;
