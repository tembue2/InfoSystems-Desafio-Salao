-- Extensão não destrutiva do MVP. Executar numa transacção.
create table public.salon_settings (
 id boolean primary key default true check(id), hold_minutes integer not null default 60 check(hold_minutes between 5 and 1440),
 policy_text text not null default 'Política de cancelamento e reembolso pendente de aprovação. Contacte a recepção antes de efectuar o pagamento.',
 policy_approved boolean not null default false
);
insert into public.salon_settings(id) values(true);
create table public.clients (
 id uuid primary key default gen_random_uuid(), profile_id uuid unique references public.profiles(id),
 full_name text not null check(length(trim(full_name)) between 1 and 120), phone text, email text,
 created_at timestamptz not null default now()
);
insert into public.clients(profile_id,full_name,phone) select id,case when full_name='' then 'Cliente' else full_name end,phone from public.profiles where role='customer';
create table public.work_hours (
 id uuid primary key default gen_random_uuid(), professional_id uuid not null references public.professionals(id),
 weekday integer not null check(weekday between 1 and 7), opens time not null, closes time not null,
 check(closes>opens), unique(professional_id,weekday)
);
insert into public.work_hours(professional_id,weekday,opens,closes) select id,d,'08:00','17:00' from public.professionals cross join generate_series(1,6) d;
create table public.time_off (
 id uuid primary key default gen_random_uuid(),professional_id uuid not null references public.professionals(id),
 starts_at timestamptz not null, ends_at timestamptz not null, reason text not null, check(ends_at>starts_at)
);
create index time_off_professional_idx on public.time_off(professional_id,starts_at);
create table public.audit_events (
 id bigint generated always as identity primary key, entity text not null, record_id text not null,
 action text not null, actor_id uuid references public.profiles(id), created_at timestamptz not null default now(), details jsonb not null
);
create table public.manual_income (
 id uuid primary key default gen_random_uuid(),description text not null check(length(trim(description))>0),
 amount_mzn numeric(12,2) not null check(amount_mzn>0),occurred_at timestamptz not null default now(),created_by uuid not null default auth.uid() references public.profiles(id)
);
alter table public.bookings add column client_id uuid references public.clients(id);
alter table public.bookings alter column customer_id drop not null;
update public.bookings b set client_id=c.id from public.clients c where c.profile_id=b.customer_id;
alter table public.bookings add constraint booking_customer_required check(customer_id is not null or client_id is not null);
alter table public.payments add column validation_status text not null default 'pending' check(validation_status in ('pending','validated','rejected'));
alter table public.payments add column reference text;
alter table public.payments add column validated_by uuid references public.profiles(id);
alter table public.payments add column validated_at timestamptz;
-- Pagamentos anteriores foram confirmados pela operação antiga; preservar essa evidência.
update public.payments set validation_status='validated',validated_by=registered_by,validated_at=received_at;
alter table public.payments drop constraint payments_booking_id_key;
create index payments_booking_idx on public.payments(booking_id);
create index clients_profile_idx on public.clients(profile_id);
alter table public.expenses alter column created_by set default auth.uid();
create schema if not exists private;
revoke all on schema private from public;
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(entity,record_id,action,actor_id,details) values(TG_TABLE_NAME,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id'),TG_OP,auth.uid(),jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new)));
 return coalesce(new,old);
end;$$;
create function private.sync_client() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.role='customer' then insert into public.clients(profile_id,full_name,phone) values(new.id,coalesce(nullif(new.full_name,''),'Cliente'),new.phone) on conflict(profile_id) do update set full_name=excluded.full_name,phone=excluded.phone; end if;
 return new;
end;$$;
create trigger sync_client after insert or update on public.profiles for each row execute function private.sync_client();
DO $$ declare t text; begin
 foreach t in array array['clients','work_hours','time_off','salon_settings','audit_events','manual_income'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['services','professionals','professional_services','products','work_hours','time_off','salon_settings'] loop
 execute format('create policy manager_write on public.%I for all to authenticated using (public.current_role()=''manager'') with check(public.current_role()=''manager'')',t);
 end loop;
 foreach t in array array['services','professionals','professional_services','work_hours','time_off','salon_settings'] loop
 execute format('grant insert,update,delete on public.%I to authenticated',t);
 end loop;
 foreach t in array array['bookings','payments','expenses','manual_income','stock_movements','services','professionals','work_hours','time_off','salon_settings'] loop
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
 end loop;
end $$;
-- Produtos: saldo apenas pela operação transaccional de stock.
revoke insert,update,delete on public.products from authenticated;
grant insert(name,kind,sale_price_mzn,min_quantity,active),update(name,kind,sale_price_mzn,min_quantity,active) on public.products to authenticated;
create policy clients_staff on public.clients for all to authenticated using(public.can_manage()) with check(public.can_manage());
create policy clients_self on public.clients for select to authenticated using(profile_id=auth.uid());
create policy clients_assigned on public.clients for select to authenticated using(exists(select 1 from public.bookings b join public.professionals p on p.id=b.professional_id where b.client_id=clients.id and p.profile_id=auth.uid()));
grant insert(full_name,phone,email),update(full_name,phone,email) on public.clients to authenticated;
create policy hours_read on public.work_hours for select to authenticated using(true);
create policy timeoff_read on public.time_off for select to authenticated using(public.current_role()='manager' or exists(select 1 from public.professionals p where p.id=professional_id and p.profile_id=auth.uid()));
create policy settings_read on public.salon_settings for select using(true);
grant select on public.salon_settings to anon;
create policy audit_manager on public.audit_events for select to authenticated using(public.current_role()='manager');
create policy income_manager on public.manual_income for all to authenticated using(public.current_role()='manager') with check(public.current_role()='manager' and created_by=auth.uid());
grant insert(description,amount_mzn,occurred_at) on public.manual_income to authenticated;
drop policy expenses_staff_read on public.expenses;
drop policy expenses_staff_insert on public.expenses;
create policy expenses_manager_read on public.expenses for select to authenticated using(public.current_role()='manager');
create policy expenses_manager_insert on public.expenses for insert to authenticated with check(public.current_role()='manager' and created_by=auth.uid());
drop policy products_staff_read on public.products;
create policy products_manager_read on public.products for select to authenticated using(public.current_role()='manager');
drop policy movements_staff_read on public.stock_movements;
create policy movements_manager_read on public.stock_movements for select to authenticated using(public.current_role()='manager');
create policy payments_customer on public.payments for select to authenticated using(exists(select 1 from public.bookings b where b.id=booking_id and b.customer_id=auth.uid()));
-- A API antiga deixa de poder confirmar pagamentos sem validação separada.
revoke execute on function public.confirm_booking_payment(uuid,public.payment_method) from authenticated,anon,public;
create or replace function public.available_slots(p_service uuid,p_professional uuid,p_day date)
returns table(slot_start timestamptz) language plpgsql stable security definer set search_path='' as $$
declare dur integer; h record; at_time timestamptz;
begin
 if auth.uid() is null then raise exception 'Inicie sessão.'; end if;
 select s.duration_minutes into dur from public.services s join public.professional_services ps on ps.service_id=s.id join public.professionals p on p.id=ps.professional_id where s.id=p_service and p.id=p_professional and s.active and p.active;
 if dur is null or p_day<(now() at time zone 'Africa/Maputo')::date or p_day>(now() at time zone 'Africa/Maputo')::date+60 then return; end if;
 for h in select * from public.work_hours where professional_id=p_professional and weekday=extract(isodow from p_day) loop
 for at_time in select generate_series((p_day+h.opens) at time zone 'Africa/Maputo',((p_day+h.closes) at time zone 'Africa/Maputo')-make_interval(mins=>dur),interval '30 minutes') loop
 if at_time>now() and not exists(select 1 from public.bookings b where b.professional_id=p_professional and (b.status in ('confirmed','in_progress') or (b.status='pending_payment' and b.expires_at>now())) and b.starts_at<at_time+make_interval(mins=>dur) and b.ends_at>at_time) and not exists(select 1 from public.time_off t where t.professional_id=p_professional and t.starts_at<at_time+make_interval(mins=>dur) and t.ends_at>at_time) then slot_start:=at_time; return next; end if;
 end loop;end loop;
end;$$;
create function public.request_booking(p_service uuid,p_professional uuid,p_starts_at timestamptz,p_client uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
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
create or replace function public.create_booking(p_service uuid,p_professional uuid,p_starts_at timestamptz) returns uuid language sql security invoker set search_path='' as $$ select public.request_booking(p_service,p_professional,p_starts_at,null); $$;
create function public.register_payment(p_booking uuid,p_amount numeric,p_method public.payment_method,p_reference text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; result uuid; paid numeric;
begin
 if auth.uid() is null or not public.can_manage() then raise exception 'Sem permissão.';end if;
 select * into b from public.bookings where id=p_booking for update;
 if not found or b.status<>'pending_payment' or b.expires_at<=now() then raise exception 'Reserva expirada ou não pendente.';end if;
 select coalesce(sum(amount_mzn),0) into paid from public.payments where booking_id=p_booking and validation_status<>'rejected' and refunded_at is null;
 if p_amount is null or p_amount<=0 or paid+p_amount>b.price_mzn then raise exception 'Montante inválido ou superior ao valor em falta.';end if;
 if p_method='pos' then raise exception 'POS excluído deste MVP.';end if;
 insert into public.payments(booking_id,amount_mzn,method,registered_by,reference) values(p_booking,p_amount,p_method,auth.uid(),nullif(trim(p_reference),'')) returning id into result;
 return result;
end;$$;
create function public.validate_payment(p_payment uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$
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
create function public.set_booking_status(p_booking uuid,p_status public.booking_status) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;
begin
 if auth.uid() is null then raise exception 'Inicie sessão.';end if;
 select * into b from public.bookings where id=p_booking for update;
 if not found or not(public.can_manage() or exists(select 1 from public.professionals where id=b.professional_id and profile_id=auth.uid())) then raise exception 'Sem permissão.';end if;
 if not ((b.status='confirmed' and p_status='in_progress') or (b.status='in_progress' and p_status='completed')) then raise exception 'Transição não permitida.';end if;
 update public.bookings set status=p_status,updated_at=now() where id=p_booking;
end;$$;
create or replace function public.cancel_booking(p_booking uuid) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;
begin
 if auth.uid() is null then raise exception 'Inicie sessão.';end if;
 select * into b from public.bookings where id=p_booking for update;
 if not found or (b.customer_id is distinct from auth.uid() and not public.can_manage()) then raise exception 'Sem permissão.';end if;
 if b.status not in ('pending_payment','confirmed') then raise exception 'Estado não cancelável.';end if;
 if not public.can_manage() and exists(select 1 from public.payments where booking_id=b.id and validation_status<>'rejected') then raise exception 'Contacte a recepção para cancelar e avaliar pagamentos e eventual reembolso.';end if;
 update public.bookings set status='cancelled',updated_at=now() where id=p_booking;
end;$$;
create or replace function public.adjust_stock(p_product uuid,p_delta integer,p_reason text) returns integer language plpgsql security definer set search_path='' as $$
declare qty integer;
begin
 if auth.uid() is null or public.current_role() is distinct from 'manager' then raise exception 'Sem permissão.';end if;
 if p_delta is null or p_delta=0 or length(trim(coalesce(p_reason,'')))=0 then raise exception 'Movimento inválido.';end if;
 update public.products set quantity=quantity+p_delta where id=p_product and quantity+p_delta>=0 returning quantity into qty;
 if not found then raise exception 'Stock insuficiente ou produto inexistente.';end if;
 insert into public.stock_movements(product_id,delta,reason,created_by) values(p_product,p_delta,p_reason,auth.uid());return qty;
end;$$;
-- Leituras agregadas respeitam RLS e não sofrem o limite de 1000 linhas da API.
create function public.finance_summary(p_from timestamptz,p_to timestamptz) returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('receipts',coalesce((select sum(amount_mzn) from public.payments where validation_status='validated' and received_at>=p_from and received_at<p_to),0), 'refunds',coalesce((select sum(amount_mzn) from public.payments where validation_status='validated' and refunded_at>=p_from and refunded_at<p_to),0), 'other',coalesce((select sum(amount_mzn) from public.manual_income where occurred_at>=p_from and occurred_at<p_to),0), 'expenses',coalesce((select sum(amount_mzn) from public.expenses where occurred_at>=p_from and occurred_at<p_to),0)) where public.current_role()='manager';$$;
create function public.refund_payment(p_payment uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.current_role() is distinct from 'manager' then raise exception 'Sem permissão.';end if;
 if length(trim(coalesce(p_reason,'')))=0 then raise exception 'Indique a decisão de reembolso.';end if;
 update public.payments p set refunded_at=now(),refunded_by=auth.uid() where p.id=p_payment and p.validation_status='validated' and p.refunded_at is null and exists(select 1 from public.bookings b where b.id=p.booking_id and (b.status in ('cancelled','expired') or (b.status='pending_payment' and b.expires_at<=now())));
 if not found then raise exception 'Reembolso não permitido neste estado.';end if;
 insert into public.audit_events(entity,record_id,action,actor_id,details) values('payments',p_payment::text,'refund_reason',auth.uid(),jsonb_build_object('reason',p_reason));
end;$$;
DO $$ declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('request_booking','register_payment','validate_payment','set_booking_status','finance_summary','refund_payment') loop
 execute format('revoke all on function %s from public,anon',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
revoke execute on function public.available_slots(uuid,uuid,date) from anon;
create function public.low_stock() returns bigint language sql security invoker set search_path='' as $$ select count(*) from public.products where active and quantity<=min_quantity; $$;
revoke all on function public.low_stock() from public,anon;
grant execute on function public.low_stock() to authenticated;
-- Protege a associação de contas e a habilitação de novos serviços sem tocar no histórico.
create function private.check_professional() returns trigger language plpgsql set search_path='' as $$
begin
 if new.profile_id is not null and not exists(select 1 from public.profiles where id=new.profile_id and role='professional') then raise exception 'Seleccione uma conta com perfil Profissional.';end if;
 return new;
end;$$;
create trigger professional_account before insert or update on public.professionals for each row execute function private.check_professional();
revoke all on function private.check_professional() from public,anon,authenticated;
