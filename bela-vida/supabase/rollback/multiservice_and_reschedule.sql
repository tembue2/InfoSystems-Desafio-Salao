-- Emergency, non-destructive feature rollback. Not applied to any remote DB.
-- Pause mutations during rollback. Retain a UI capable of displaying multiple
-- items; never roll back to a UI that renders only service_id for old bundles.
-- New multi-service creation/rescheduling stops. Legacy single-service API works.
begin;
revoke execute on function public.request_booking_services(uuid[],uuid,timestamptz,uuid) from authenticated;
revoke execute on function public.reschedule_booking(uuid,uuid,timestamptz) from authenticated;
create or replace function public.request_booking(p_service uuid,p_professional uuid,p_starts_at timestamptz,p_client uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; customer uuid; client uuid; s public.services%rowtype; hold integer;
begin
 if auth.uid() is null then raise exception 'Inicie sessão.'; end if;
 if p_client is not null and not public.can_manage() then raise exception 'Sem permissão.'; end if;
 perform pg_advisory_xact_lock(hashtext(p_professional::text));
 if not exists(select 1 from public.available_slots(p_service,p_professional,(p_starts_at at time zone 'Africa/Maputo')::date) where slot_start=p_starts_at) then raise exception 'Horário indisponível. Actualize a agenda.'; end if;
 select * into s from public.services where id=p_service;
 if p_client is null then customer:=auth.uid(); select id into client from public.clients where profile_id=customer;
 else select id,profile_id into client,customer from public.clients where id=p_client; if client is null then raise exception 'Cliente inexistente.'; end if;end if;
 select hold_minutes into hold from public.salon_settings;
 insert into public.bookings(customer_id,client_id,service_id,professional_id,starts_at,ends_at,price_mzn,expires_at) values(customer,client,p_service,p_professional,p_starts_at,p_starts_at+make_interval(mins=>s.duration_minutes),s.price_mzn,now()+make_interval(mins=>hold)) returning id into result;
 return result;
end;$$;
create or replace function public.validate_payment(p_payment uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; p public.payments%rowtype; total numeric;
begin
 if auth.uid() is null or not public.can_manage() then raise exception 'Sem permissão.';end if;
 select b0.* into b from public.bookings b0 join public.payments p0 on p0.booking_id=b0.id where p0.id=p_payment;
 if not found then raise exception 'Pagamento inexistente.';end if;
 perform pg_advisory_xact_lock(hashtext(b.professional_id::text));
 select * into b from public.bookings where id=b.id for update;
 select * into p from public.payments where id=p_payment for update;
 if p.validation_status<>'pending' then raise exception 'Pagamento já tratado.';end if;
 if p_approve and (b.status<>'pending_payment' or b.expires_at<=now()) then raise exception 'Reserva expirada ou cancelada. Não validar; tratar com a gerência.';end if;
 update public.payments set validation_status=case when p_approve then 'validated' else 'rejected' end,validated_by=auth.uid(),validated_at=now() where id=p_payment;
 select coalesce(sum(amount_mzn),0) into total from public.payments where booking_id=b.id and validation_status='validated' and refunded_at is null;
 if p_approve and total=b.price_mzn then
 if exists(select 1 from public.bookings x where x.professional_id=b.professional_id and x.id<>b.id and (x.status in ('confirmed','in_progress') or (x.status='pending_payment' and x.expires_at>now())) and x.starts_at<b.ends_at and x.ends_at>b.starts_at) then raise exception 'Conflito de horário.';end if;
 update public.bookings set status='confirmed',updated_at=now() where id=b.id;
 end if;
end;$$;

-- Preserve the item invariant for single bookings created by the restored API.
create or replace function management_private.legacy_item_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 insert into public.booking_items(booking_id,position,service_id,service_name,price_mzn,duration_minutes)
 select new.id,1,new.service_id,s.name,new.price_mzn,(extract(epoch from new.ends_at-new.starts_at)/60)::integer from public.services s where s.id=new.service_id;
 return new;
end $$;
revoke all on function management_private.legacy_item_snapshot() from public,anon,authenticated;
create trigger legacy_item_snapshot after insert on public.bookings
 for each row execute function management_private.legacy_item_snapshot();
notify pgrst, 'reload schema';
commit;
-- Re-enabling features requires dropping legacy_item_snapshot and restoring the
-- request_booking/validate_payment definitions and EXECUTE grants from the new
-- migration. Do not replay CREATE TABLE or the backfill over existing items.
