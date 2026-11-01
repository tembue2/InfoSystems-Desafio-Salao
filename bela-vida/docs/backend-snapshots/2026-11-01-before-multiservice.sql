-- Snapshot before authorised multiservice/reschedule migration.
-- InfoSystems-Desafio-Salao; 2026-11-01. Definitions only, no customer records.
CREATE OR REPLACE FUNCTION public.available_slots(p_service uuid, p_professional uuid, p_day date)
 RETURNS TABLE(slot_start timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare dur integer; h record; at_time timestamptz;
begin
 if auth.uid() is null then raise exception 'Inicie sessão.'; end if;
 select s.duration_minutes into dur from public.services s join public.professional_services ps on ps.service_id=s.id join public.professionals p on p.id=ps.professional_id where s.id=p_service and p.id=p_professional and s.active and p.active;
 if dur is null or p_day<(now() at time zone 'Africa/Maputo')::date or p_day>(now() at time zone 'Africa/Maputo')::date+60 then return; end if;
 for h in select * from public.work_hours where professional_id=p_professional and weekday=extract(isodow from p_day) loop
 for at_time in select generate_series((p_day+h.opens) at time zone 'Africa/Maputo',((p_day+h.closes) at time zone 'Africa/Maputo')-make_interval(mins=>dur),interval '30 minutes') loop
 if at_time>now() and not exists(select 1 from public.bookings b where b.professional_id=p_professional and (b.status in ('confirmed','in_progress') or (b.status='pending_payment' and b.expires_at>now())) and b.starts_at<at_time+make_interval(mins=>dur) and b.ends_at>at_time) and not exists(select 1 from public.time_off t where t.professional_id=p_professional and t.starts_at<at_time+make_interval(mins=>dur) and t.ends_at>at_time) then slot_start:=at_time; return next; end if;
 end loop;end loop;
end;$function$
;

CREATE OR REPLACE FUNCTION public.can_manage()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select coalesce(public.current_role() in ('manager','reception'),false); $function$
;

CREATE OR REPLACE FUNCTION public.create_booking(p_service uuid, p_professional uuid, p_starts_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select public.request_booking(p_service,p_professional,p_starts_at,null); $function$
;

CREATE OR REPLACE FUNCTION public."current_role"()
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select role from public.profiles where id=auth.uid(); $function$
;

CREATE OR REPLACE FUNCTION public.request_booking(p_service uuid, p_professional uuid, p_starts_at timestamp with time zone, p_client uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end;$function$
;

CREATE OR REPLACE FUNCTION public.validate_payment(p_payment uuid, p_approve boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end;$function$
;

