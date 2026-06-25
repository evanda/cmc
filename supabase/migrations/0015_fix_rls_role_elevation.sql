-- ───────────────────────────────────────────────────────────────────────────
-- 0015_fix_rls_role_elevation.sql — patch users_update_self RLS (plan §7.5)
--
-- Bug: the original WITH CHECK in users_update_self only verified id = auth.uid(),
-- preventing a user from changing their own id but NOT preventing them from
-- changing their own role.  Any authenticated user could self-promote to admin
-- via: UPDATE users SET role = 'admin' WHERE id = auth.uid();
--
-- Fix: add `role = current_app_role()` to the WITH CHECK so the proposed new
-- role must match the user's current committed role, blocking self-promotion.
-- Admins retain the ability to change any user's role (including their own)
-- through the separate users_admin_write policy (which has no role restriction).
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using   (id = auth.uid())
  with check (id = auth.uid() and role = public.current_app_role());
