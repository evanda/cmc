-- ───────────────────────────────────────────────────────────────────────────
-- 0007_work_order_photo_storage.sql — Storage bucket for work-order photos
-- Guarded to no-op where the Supabase `storage` schema is absent (local verify).
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema absent — skipping work-order-photos bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('work-order-photos', 'work-order-photos', true)
  on conflict (id) do nothing;

  drop policy if exists work_order_photos_read on storage.objects;
  create policy work_order_photos_read on storage.objects
    for select using (bucket_id = 'work-order-photos');

  drop policy if exists work_order_photos_staff_write on storage.objects;
  create policy work_order_photos_staff_write on storage.objects
    for all to authenticated
    using (bucket_id = 'work-order-photos' and public.is_staff())
    with check (bucket_id = 'work-order-photos' and public.is_staff());
end $$;
