-- Additive integration migration. Apply to isolated tests first; never replay the
-- mirror_infosystems_for_local_tests migration against an existing project.
-- Abort rather than round an unexpected historical sub-minute duration.
do $$ begin
 if exists(select 1 from public.bookings where extract(epoch from ends_at-starts_at)::numeric % 60 <> 0) then
 raise exception 'Existem durações históricas com segundos. Rever antes de migrar.';
 end if;
end $$;
create schema if not exists management_private;
revoke all on schema management_private from public, anon, authenticated;

create table public.booking_items (
 booking_id uuid not null references public.bookings(id),
 position integer not null check(position > 0),
 service_id uuid not null references public.services(id),
 service_name text not null,
 price_mzn numeric(12,2) not null check(price_mzn >= 0),
 duration_minutes integer not null check(duration_minutes > 0),
 primary key(booking_id,position), unique(booking_id,service_id)
);
create index booking_items_service_idx on public.booking_items(service_id);
alter table public.booking_items enable row level security;
revoke all on public.booking_items from public,anon,authenticated;
grant select on public.booking_items to authenticated;
create policy booking_items_parent_read on public.booking_items for select to authenticated
 using(exists(select 1 from public.bookings b where b.id=booking_id));
-- Existing bookings preserve their contracted aggregate price and duration.
-- Only the current service name is recoverable for historical single services.
insert into public.booking_items(booking_id,position,service_id,service_name,price_mzn,duration_minutes)
 select b.id,1,b.service_id,s.name,b.price_mzn,
 (extract(epoch from b.ends_at-b.starts_at)/60)::integer
 from public.bookings b join public.services s on s.id=b.service_id;

-- Shared slot calculation, inaccessible through the Data API. The exclusion is
-- supplied only by the authorised reschedule wrapper, never by a public caller.
create function management_private.slots(p_professional uuid,p_day date,p_minutes integer,p_exclude uuid default null)
returns table(slot_start timestamptz) language sql stable security invoker set search_path='' as $$
 select t.at_time from public.work_hours h
 cross join lateral generate_series((p_day+h.opens) at time zone 'Africa/Maputo',
 ((p_day+h.closes) at time zone 'Africa/Maputo')-make_interval(mins=>p_minutes),interval '30 minutes') t(at_time)
 where h.professional_id=p_professional and h.weekday=extract(isodow from p_day)
 and p_minutes>0 and p_day between (now() at time zone 'Africa/Maputo')::date and (now() at time zone 'Africa/Maputo')::date+60
 and t.at_time>now()
 and not exists(select 1 from public.bookings b where b.professional_id=p_professional
 and (p_exclude is null or b.id<>p_exclude)
 and (b.status in ('confirmed','in_progress') or (b.status='pending_payment' and b.expires_at>now()))
 and b.starts_at<t.at_time+make_interval(mins=>p_minutes) and b.ends_at>t.at_time)
 and not exists(select 1 from public.time_off x where x.professional_id=p_professional
 and x.starts_at<t.at_time+make_interval(mins=>p_minutes) and x.ends_at>t.at_time)
 order by t.at_time;
$$;
revoke all on function management_private.slots(uuid,date,integer,uuid) from public,anon,authenticated;

create function public.available_booking_slots(p_services uuid[],p_professional uuid,p_day date)
returns table(slot_start timestamptz) language plpgsql stable security definer set search_path='' as $$
declare dur integer; n integer;
begin
 if auth.uid() is null then raise exception 'Inicie sessão.';end if;
 if p_services is null or cardinality(p_services) not between 1 and 20
 or cardinality(p_services)<>(select count(distinct x) from unnest(p_services) x) then raise exception 'Serviços inválidos.';end if;
 select count(*),sum(s.duration_minutes) into n,dur from public.services s
 join public.professional_services ps on ps.service_id=s.id and ps.professional_id=p_professional
 join public.professionals p on p.id=ps.professional_id
 where s.id=any(p_services) and s.active and p.active;
 if n<>cardinality(p_services) then return;end if;
 return query select * from management_private.slots(p_professional,p_day,dur);
end;$$;

create function public.request_booking_services(p_services uuid[],p_professional uuid,p_starts_at timestamptz,p_client uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; customer uuid; client uuid; hold integer; total numeric; dur integer;
begin
 if auth.uid() is null then raise exception 'Inicie sessão.';end if;
 if p_client is not null and not public.can_manage() then raise exception 'Sem permissão.';end if;
 perform pg_advisory_xact_lock(hashtext(p_professional::text));
 -- Keep catalogue snapshots stable until transaction commit.
 perform s.id from public.services s where s.id=any(p_services) order by s.id for share;
 if not exists(select 1 from public.available_booking_slots(p_services,p_professional,(p_starts_at at time zone 'Africa/Maputo')::date) where slot_start=p_starts_at) then raise exception 'Horário indisponível. Actualize a agenda.';end if;
 if p_client is null then customer:=auth.uid(); select id into client from public.clients where profile_id=customer;
 else select id,profile_id into client,customer from public.clients where id=p_client; if client is null then raise exception 'Cliente inexistente.';end if;end if;
 select hold_minutes into hold from public.salon_settings where id=true;
 select sum(price_mzn),sum(duration_minutes) into total,dur from public.services where id=any(p_services);
 insert into public.bookings(customer_id,client_id,service_id,professional_id,starts_at,ends_at,price_mzn,expires_at)
 values(customer,client,p_services[1],p_professional,p_starts_at,p_starts_at+make_interval(mins=>dur),total,now()+make_interval(mins=>hold)) returning id into result;
 insert into public.booking_items(booking_id,position,service_id,service_name,price_mzn,duration_minutes)
 select result,x.position,s.id,s.name,s.price_mzn,s.duration_minutes
 from unnest(p_services) with ordinality x(id,position) join public.services s on s.id=x.id;
 return result;
end;$$;
-- Old single-service clients retain the same signature and return value.
create or replace function public.request_booking(p_service uuid,p_professional uuid,p_starts_at timestamptz,p_client uuid default null)
returns uuid language sql security invoker set search_path='' as $$
 select public.request_booking_services(array[p_service],p_professional,p_starts_at,p_client);
$$;

create function public.available_reschedule_slots(p_booking uuid,p_professional uuid,p_day date)
returns table(slot_start timestamptz) language plpgsql stable security definer set search_path='' as $$
declare b public.bookings%rowtype;
begin
 if auth.uid() is null or not public.can_manage() then raise exception 'Sem permissão.';end if;
 select * into b from public.bookings where id=p_booking;
 if not found or b.status not in ('pending_payment','confirmed') or (b.status='pending_payment' and b.expires_at<=now()) then raise exception 'Estado não reagendável.';end if;
 if not exists(select 1 from public.professionals where id=p_professional and active)
 or exists(select 1 from public.booking_items i left join public.services s on s.id=i.service_id
 where i.booking_id=p_booking and (not s.active or not exists(select 1 from public.professional_services ps where ps.professional_id=p_professional and ps.service_id=i.service_id))) then return;end if;
 return query select * from management_private.slots(p_professional,p_day,(extract(epoch from b.ends_at-b.starts_at)/60)::integer,p_booking);
end;$$;

create function public.reschedule_booking(p_booking uuid,p_professional uuid,p_starts_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; lock_id bigint;
begin
 if auth.uid() is null or not public.can_manage() then raise exception 'Sem permissão.';end if;
 -- Serialise rescheduling/payment validation for the same booking before taking
 -- professional locks. No row lock is held while waiting for professional locks.
 perform pg_advisory_xact_lock(hashtextextended('booking:'||p_booking::text,0));
 select * into b from public.bookings where id=p_booking;
 if not found then raise exception 'Marcação inexistente.';end if;
 for lock_id in select distinct hashtext(x::text)::bigint from unnest(array[b.professional_id,p_professional]) x order by 1 loop
 perform pg_advisory_xact_lock(lock_id);end loop;
 select * into b from public.bookings where id=p_booking for update;
 if not exists(select 1 from public.available_reschedule_slots(p_booking,p_professional,(p_starts_at at time zone 'Africa/Maputo')::date) where slot_start=p_starts_at) then raise exception 'Horário indisponível. Actualize a agenda.';end if;
 if b.professional_id=p_professional and b.starts_at=p_starts_at then return;end if;
 update public.bookings set professional_id=p_professional,starts_at=p_starts_at,
 ends_at=p_starts_at+(b.ends_at-b.starts_at),updated_at=now() where id=p_booking;
end;$$;

-- Same lock ordering as reschedule; payment business rules remain unchanged.
create or replace function public.validate_payment(p_payment uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; p public.payments%rowtype; total numeric;
begin
 if auth.uid() is null or not public.can_manage() then raise exception 'Sem permissão.';end if;
 select b0.* into b from public.bookings b0 join public.payments p0 on p0.booking_id=b0.id where p0.id=p_payment;
 if not found then raise exception 'Pagamento inexistente.';end if;
 perform pg_advisory_xact_lock(hashtextextended('booking:'||b.id::text,0));
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
revoke all on function public.available_booking_slots(uuid[],uuid,date) from public,anon,authenticated;
grant execute on function public.available_booking_slots(uuid[],uuid,date) to authenticated;
revoke all on function public.request_booking_services(uuid[],uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.request_booking_services(uuid[],uuid,timestamptz,uuid) to authenticated;
revoke all on function public.available_reschedule_slots(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.available_reschedule_slots(uuid,uuid,date) to authenticated;
revoke all on function public.reschedule_booking(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.reschedule_booking(uuid,uuid,timestamptz) to authenticated;
notify pgrst, 'reload schema';
