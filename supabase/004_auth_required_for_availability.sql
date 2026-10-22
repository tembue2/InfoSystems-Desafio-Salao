-- O MVP exige conta para marcar e consultar horários livres.
revoke execute on function public.available_slots(uuid,uuid,date) from anon;
grant execute on function public.available_slots(uuid,uuid,date) to authenticated;
