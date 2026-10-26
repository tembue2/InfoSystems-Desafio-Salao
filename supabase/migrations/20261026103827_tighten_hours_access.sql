drop policy hours_read on public.work_hours;
create policy hours_read on public.work_hours for select to authenticated using(
 public.current_role()='manager' or exists(select 1 from public.professionals p where p.id=professional_id and p.profile_id=auth.uid())
);
revoke insert,delete on public.salon_settings from authenticated;
