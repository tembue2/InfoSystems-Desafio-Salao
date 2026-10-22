-- Aplicada ao projecto InfoSystems-Desafio-Salao após auditoria.
-- Remove privilégios directos e herdados por PUBLIC/anon/authenticated.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.current_role() from public, anon, authenticated;
revoke execute on function public.is_staff() from public, anon, authenticated;
revoke execute on function public.can_manage() from public, anon, authenticated;
revoke execute on function public.available_slots(uuid,uuid,date) from public, anon, authenticated;
revoke execute on function public.create_booking(uuid,uuid,timestamptz) from public, anon, authenticated;
revoke execute on function public.confirm_booking_payment(uuid,public.payment_method) from public, anon, authenticated;
revoke execute on function public.cancel_booking(uuid) from public, anon, authenticated;
revoke execute on function public.adjust_stock(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.can_manage() to authenticated;
grant execute on function public.available_slots(uuid,uuid,date) to anon,authenticated;
grant execute on function public.create_booking(uuid,uuid,timestamptz) to authenticated;
grant execute on function public.confirm_booking_payment(uuid,public.payment_method) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.adjust_stock(uuid,integer,text) to authenticated;
