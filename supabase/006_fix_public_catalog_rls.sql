-- Supabase migration: fix_public_catalog_rls_without_staff_execute
-- Público anónimo consulta apenas catálogo activo, sem executar is_staff().
-- Autenticados consultam catálogo activo; equipa pode consultar também inactivos.

drop policy if exists services_public_read on public.services;
create policy services_anon_active_read on public.services
for select to anon using (active = true);
create policy services_authenticated_read on public.services
for select to authenticated using (active = true or (select public.is_staff()));

drop policy if exists professionals_public_read on public.professionals;
create policy professionals_anon_active_read on public.professionals
for select to anon using (active = true);
create policy professionals_authenticated_read on public.professionals
for select to authenticated using (active = true or (select public.is_staff()));
