-- ============================================================================
-- Storage bucket for product/category image uploads from the admin dashboard.
--
-- One public bucket, "catalog-images", holding two folders (products/,
-- categories/) written by the admin Product/Category forms. Public read is
-- required — these URLs are rendered directly on the storefront. Only admins
-- (public.is_admin(), already defined in 20260904040000_phase4_admin_dashboard_access.sql)
-- may write.
--
-- Not applied automatically. Review, then run via the Supabase SQL editor.
-- No service-role key involved.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', true)
on conflict (id) do nothing;

drop policy if exists "catalog_images_public_read" on storage.objects;
create policy "catalog_images_public_read" on storage.objects
  for select using (bucket_id = 'catalog-images');

drop policy if exists "catalog_images_admin_insert" on storage.objects;
create policy "catalog_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'catalog-images' and public.is_admin());

drop policy if exists "catalog_images_admin_update" on storage.objects;
create policy "catalog_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'catalog-images' and public.is_admin())
  with check (bucket_id = 'catalog-images' and public.is_admin());

drop policy if exists "catalog_images_admin_delete" on storage.objects;
create policy "catalog_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalog-images' and public.is_admin());
