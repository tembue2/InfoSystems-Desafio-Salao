create table public.booking_requests (
 id uuid primary key default gen_random_uuid(), request_key uuid not null unique,
 full_name text not null check(char_length(full_name) between 2 and 100),
 phone text not null check(phone ~ '^[0-9+]{9,15}$'), notes text not null default '' check(char_length(notes)<=1000),
 service_ids uuid[] not null, professional_id uuid not null references public.professionals(id), starts_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 booking_id uuid references public.bookings(id), reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.booking_requests enable row level security;
revoke all on public.booking_requests from anon,authenticated;
grant select on public.booking_requests to authenticated;
create policy requests_staff on public.booking_requests for select to authenticated using ((select public.can_manage()));
create index booking_requests_status_created on public.booking_requests(status,created_at desc);
create index booking_requests_phone_created on public.booking_requests(phone,created_at desc);

create function public.public_booking_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'price',s.price_mzn,'minutes',s.duration_minutes) order by s.name) from public.services s where s.active and exists(select 1 from public.professional_services ps join public.professionals p on p.id=ps.professional_id where ps.service_id=s.id and p.active)),'[]'::jsonb));
$$;
create function public.public_booking_slots(p_services uuid[],p_day date) returns table(professional_id uuid,professional_name text,starts_at timestamptz) language plpgsql stable security definer set search_path='' as $$
declare duration integer;
begin
 if p_services is null or cardinality(p_services) not between 1 and 20 or cardinality(p_services)<>(select count(distinct x) from unnest(p_services) x) then raise exception 'Escolha serviços válidos.'; end if;
 if (select count(*) from public.services where id=any(p_services) and active)<>cardinality(p_services) then raise exception 'O catálogo foi actualizado. Volte a escolher os serviços.';end if;
 select sum(duration_minutes) into duration from public.services where id=any(p_services);
 return query select p.id,p.display_name,s.slot_start from public.professionals p cross join lateral management_private.slots(p.id,p_day,duration,null) s where p.active and (select count(*) from public.professional_services a where a.professional_id=p.id and a.service_id=any(p_services))=cardinality(p_services) order by s.slot_start,p.display_name;
end; $$;
create function public.submit_booking_request(p_key uuid,p_name text,p_phone text,p_notes text,p_services uuid[],p_professional uuid,p_starts_at timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; phone_normalized text:=regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g');
begin
 if p_key is null or p_name is null or char_length(trim(p_name)) not between 2 and 100 or phone_normalized !~ '^[0-9+]{9,15}$' or char_length(coalesce(p_notes,''))>1000 then raise exception 'Verifique o nome e o telefone.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,4));
 select id into result from public.booking_requests where request_key=p_key;
 if result is not null then return result;end if;
 perform pg_advisory_xact_lock(hashtextextended(phone_normalized,5));
 if (select count(*) from public.booking_requests where phone=phone_normalized and created_at>now()-interval '1 hour')>=3 then raise exception 'Já enviou vários pedidos. Contacte a recepção.';end if;
 if not exists(select 1 from public.public_booking_slots(p_services,(p_starts_at at time zone 'Africa/Maputo')::date) s where s.professional_id=p_professional and s.starts_at=p_starts_at) then raise exception 'Este horário já não está disponível. Escolha outro.';end if;
 insert into public.booking_requests(request_key,full_name,phone,notes,service_ids,professional_id,starts_at) values(p_key,trim(p_name),phone_normalized,coalesce(p_notes,''),p_services,p_professional,p_starts_at) returning id into result;
 return result;
end; $$;
create function public.review_booking_request(p_request uuid,p_approve boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.booking_requests%rowtype; client uuid; booking uuid;
begin
 if auth.uid() is null or not public.can_manage() then raise exception 'Sem permissão.';end if;
 select * into r from public.booking_requests where id=p_request for update;
 if not found then raise exception 'Pedido não encontrado.';end if;
 if r.status='approved' and p_approve then return r.booking_id;end if;
 if r.status<>'pending' then raise exception 'Este pedido já foi tratado.';end if;
 if p_approve then
  insert into public.clients(full_name,phone) values(r.full_name,r.phone) returning id into client;
  booking:=public.request_booking_services(r.service_ids,r.professional_id,r.starts_at,client);
 end if;
 update public.booking_requests set status=case when p_approve then 'approved' else 'rejected' end,booking_id=booking,reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
 return booking;
end; $$;
revoke all on function public.public_booking_catalog(),public.public_booking_slots(uuid[],date),public.submit_booking_request(uuid,text,text,text,uuid[],uuid,timestamptz),public.review_booking_request(uuid,boolean) from public;
grant execute on function public.public_booking_catalog(),public.public_booking_slots(uuid[],date),public.submit_booking_request(uuid,text,text,text,uuid[],uuid,timestamptz) to anon,authenticated;
grant execute on function public.review_booking_request(uuid,boolean) to authenticated;
create trigger audit_change after insert or update or delete on public.booking_requests for each row execute function private.audit_change();
revoke execute on function public.review_booking_request(uuid,boolean) from anon;

