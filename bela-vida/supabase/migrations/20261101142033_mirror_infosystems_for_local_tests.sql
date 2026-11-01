-- LOCAL TEST DATABASE ONLY. Reuses the audited InfoSystems schema; no production records.
-- Source: tembue2/InfoSystems-Desafio-Salao @ 0e3e09d8e70458d22e06797e9e6be84573a1fd4e

-- SOURCE supabase/001_initial.sql
-- InfoSystems · MVP de Salão de Beleza · Migração inicial (Supabase PostgreSQL)
-- Executar uma vez no SQL Editor de um projecto de TESTES.
-- Decisões técnicas: horário 08–17h, segunda a sábado; pagamento confirmado manualmente;
-- pré-reservas expiram em 60 minutos; valores em meticais; duração estimada editável via catálogo.

create extension if not exists pgcrypto;

create type public.app_role as enum ('manager','reception','professional','customer');
create type public.booking_status as enum ('pending_payment','confirmed','in_progress','completed','cancelled','expired');
create type public.payment_method as enum ('cash','mpesa','emola','bank_transfer','pos');
create type public.stock_kind as enum ('sale','consumable');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  full_name text not null default '',
  phone text,
  birth_date date,
  created_at timestamptz not null default now()
);
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null,
  active boolean not null default true
);
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  price_mzn numeric(12,2) not null check (price_mzn >= 0),
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  active boolean not null default true
);
create table public.professional_services (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (professional_id,service_id)
);
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  professional_id uuid not null references public.professionals(id),
  service_id uuid not null references public.services(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_mzn numeric(12,2) not null check (price_mzn >= 0),
  status public.booking_status not null default 'pending_payment',
  expires_at timestamptz not null,
  refund_due boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index bookings_professional_range_idx on public.bookings(professional_id,starts_at,ends_at);
create index bookings_customer_idx on public.bookings(customer_id,created_at desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references public.bookings(id),
  amount_mzn numeric(12,2) not null check (amount_mzn >= 0),
  method public.payment_method not null,
  registered_by uuid not null references public.profiles(id),
  received_at timestamptz not null default now(),
  refunded_at timestamptz,
  refunded_by uuid references public.profiles(id)
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount_mzn numeric(12,2) not null check (amount_mzn > 0),
  occurred_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id)
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.stock_kind not null,
  sale_price_mzn numeric(12,2) check (sale_price_mzn >= 0),
  quantity integer not null default 0 check (quantity >= 0),
  min_quantity integer not null default 0 check (min_quantity >= 0),
  active boolean not null default true
);
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  delta integer not null check (delta <> 0),
  reason text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- O registo de novos utilizadores cria sempre um perfil de CLIENTE.
-- Alterações para funções internas só através do SQL Editor com controlo da gerência.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles(id, role, full_name, phone)
  values(new.id, 'customer', left(coalesce(new.raw_user_meta_data->>'full_name',''),120),
         left(coalesce(new.raw_user_meta_data->>'phone',''),40));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_role() returns public.app_role language sql stable security definer
set search_path = public as $$ select role from public.profiles where id=auth.uid(); $$;
create or replace function public.is_staff() returns boolean language sql stable security definer
set search_path = public as $$ select coalesce(public.current_role() in ('manager','reception','professional'),false); $$;
create or replace function public.can_manage() returns boolean language sql stable security definer
set search_path = public as $$ select coalesce(public.current_role() in ('manager','reception'),false); $$;

alter table public.profiles enable row level security;
alter table public.professionals enable row level security;
alter table public.services enable row level security;
alter table public.professional_services enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

create policy profiles_read on public.profiles for select to authenticated
using (id=auth.uid() or public.can_manage());
create policy profiles_update_personal on public.profiles for update to authenticated
using (id=auth.uid()) with check (id=auth.uid());
-- Evita que o cliente altere role mesmo que a política de update permita editar o próprio perfil.
revoke update on public.profiles from authenticated;
grant update (full_name,phone,birth_date) on public.profiles to authenticated;
create policy professionals_public_read on public.professionals for select using (active or public.is_staff());
create policy services_public_read on public.services for select using (active or public.is_staff());
create policy professional_services_public_read on public.professional_services for select using (true);
create policy bookings_read on public.bookings for select to authenticated
using (customer_id=auth.uid() or public.can_manage() or
       (public.current_role()='professional' and exists (select 1 from public.professionals pr
        where pr.id=professional_id and pr.profile_id=auth.uid())));
create policy payments_staff_read on public.payments for select to authenticated using (public.can_manage());
create policy expenses_staff_read on public.expenses for select to authenticated using (public.can_manage());
create policy expenses_staff_insert on public.expenses for insert to authenticated
with check (public.can_manage() and created_by=auth.uid());
create policy products_staff_read on public.products for select to authenticated using (public.is_staff());
create policy movements_staff_read on public.stock_movements for select to authenticated using (public.can_manage());

-- Um slot está disponível se não existir reserva activa com intersecção de intervalos.
-- "pending_payment" expirada deixa de bloquear mesmo antes da limpeza.
create or replace function public.available_slots(p_service uuid, p_professional uuid, p_day date)
returns table(slot_start timestamptz) language plpgsql stable security definer set search_path=public as $$
declare v_duration integer; v_local timestamp; v_at timestamptz;
begin
  select s.duration_minutes into v_duration from public.services s
  join public.professional_services ps on ps.service_id=s.id
  join public.professionals pr on pr.id=ps.professional_id
  where s.id=p_service and ps.professional_id=p_professional and s.active and pr.active;
  if v_duration is null or p_day<((now() at time zone 'Africa/Maputo')::date)
     or p_day>((now() at time zone 'Africa/Maputo')::date + 60)
     or extract(isodow from p_day)=7 then return; end if;
  for v_local in select generate_series(p_day::timestamp + interval '8 hours',
      p_day::timestamp + interval '17 hours' - make_interval(mins=>v_duration), interval '30 minutes') loop
    v_at := v_local at time zone 'Africa/Maputo';
    if v_at <= now() then continue; end if;
    if not exists (
      select 1 from public.bookings b
      where b.professional_id=p_professional
      and (b.status in ('confirmed','in_progress') or
          (b.status='pending_payment' and b.expires_at>now()))
      and b.starts_at < v_at + make_interval(mins=>v_duration)
      and b.ends_at > v_at
    ) then slot_start:=v_at; return next; end if;
  end loop;
end; $$;

-- Criação atómica: bloqueio transaccional por profissional + teste de intersecção.
-- Não confia em verificação feita pelo browser.
create or replace function public.create_booking(p_service uuid,p_professional uuid,p_starts_at timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_duration integer; v_price numeric(12,2); v_local timestamp; v_ends timestamptz; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicie sessão antes de reservar.'; end if;
  select s.duration_minutes,s.price_mzn into v_duration,v_price
  from public.services s join public.professional_services ps on ps.service_id=s.id
  join public.professionals pr on pr.id=ps.professional_id
  where s.id=p_service and ps.professional_id=p_professional and s.active and pr.active;
  if v_duration is null then raise exception 'Serviço/profissional indisponível.'; end if;
  v_local:=p_starts_at at time zone 'Africa/Maputo';
  v_ends:=p_starts_at+make_interval(mins=>v_duration);
  if p_starts_at<=now() or p_starts_at>now()+interval '60 days'
     or extract(isodow from v_local)=7
     or v_local::time < time '08:00'
     or (v_ends at time zone 'Africa/Maputo')::date <> v_local::date
     or (v_ends at time zone 'Africa/Maputo')::time>time '17:00'
     or extract(minute from v_local)::integer % 30 <> 0
     or extract(second from v_local)<>0 then
    raise exception 'Horário fora das regras do salão.';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_professional::text));
  update public.bookings set status='expired',updated_at=now()
   where professional_id=p_professional and status='pending_payment' and expires_at<=now();
  if exists (select 1 from public.bookings b where b.professional_id=p_professional
      and b.status in ('pending_payment','confirmed','in_progress')
      and b.starts_at<v_ends and b.ends_at>p_starts_at) then
    raise exception 'Horário já ocupado. Escolha outro.';
  end if;
  insert into public.bookings(customer_id,service_id,professional_id,starts_at,ends_at,price_mzn,expires_at)
  values(auth.uid(),p_service,p_professional,p_starts_at,v_ends,v_price,now()+interval '60 minutes')
  returning id into v_id;
  return v_id;
end; $$;

-- Verifica pagamento INTEGRAL registado por funcionário e confirma reserva na mesma transacção.
create or replace function public.confirm_booking_payment(p_booking uuid,p_method public.payment_method)
returns void language plpgsql security definer set search_path=public as $$
declare v_booking public.bookings%rowtype;
begin
  if not public.can_manage() then raise exception 'Sem permissão para validar pagamentos.'; end if;
  select * into v_booking from public.bookings where id=p_booking;
  if not found then raise exception 'Marcação inexistente.'; end if;
  perform pg_advisory_xact_lock(hashtext(v_booking.professional_id::text));
  select * into v_booking from public.bookings where id=p_booking for update;
  if v_booking.status<>'pending_payment' or v_booking.expires_at<=now() then
    raise exception 'A reserva já não está pendente ou expirou.';
  end if;
  if exists(select 1 from public.bookings b where b.professional_id=v_booking.professional_id
    and b.id<>p_booking and b.status in ('confirmed','in_progress')
    and b.starts_at<v_booking.ends_at and b.ends_at>v_booking.starts_at) then
    raise exception 'Conflito de horário.';
  end if;
  insert into public.payments(booking_id,amount_mzn,method,registered_by)
  values(v_booking.id,v_booking.price_mzn,p_method,auth.uid());
  update public.bookings set status='confirmed',updated_at=now() where id=p_booking;
end; $$;

-- Cancelamento: cliente só cancela directamente com >24h de antecedência.
-- Se já pagou, reembolso é sinalizado e processado manualmente pela gerência.
create or replace function public.cancel_booking(p_booking uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_booking public.bookings%rowtype; v_manager boolean;
begin
  select * into v_booking from public.bookings where id=p_booking for update;
  if not found then raise exception 'Marcação inexistente.'; end if;
  v_manager:=public.can_manage();
  if v_booking.customer_id<>auth.uid() and not v_manager then raise exception 'Sem permissão.'; end if;
  if v_booking.status not in ('pending_payment','confirmed') then raise exception 'Marcação não cancelável.'; end if;
  if not v_manager and v_booking.starts_at<=now()+interval '24 hours' then
    raise exception 'Contacte o salão para cancelamentos com menos de 24 horas.';
  end if;
  update public.bookings set status='cancelled',updated_at=now(),
    refund_due=(v_booking.status='confirmed' and v_booking.starts_at>now()+interval '24 hours')
  where id=p_booking;
end; $$;

-- Gestão de inventário: apenas gerência/recepção, nunca permitir saldos negativos.
create or replace function public.adjust_stock(p_product uuid,p_delta integer,p_reason text)
returns integer language plpgsql security definer set search_path=public as $$
declare v_qty integer;
begin
  if not public.can_manage() then raise exception 'Sem permissão.'; end if;
  if p_delta=0 or length(trim(coalesce(p_reason,'')))=0 then raise exception 'Movimento inválido.'; end if;
  update public.products set quantity=quantity+p_delta
  where id=p_product and quantity+p_delta>=0 returning quantity into v_qty;
  if not found then raise exception 'Produto inexistente ou stock insuficiente.'; end if;
  insert into public.stock_movements(product_id,delta,reason,created_by)
  values(p_product,p_delta,p_reason,auth.uid());
  return v_qty;
end; $$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.current_role() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.can_manage() from public;
revoke all on function public.available_slots(uuid,uuid,date) from public;
revoke all on function public.create_booking(uuid,uuid,timestamptz) from public;
revoke all on function public.confirm_booking_payment(uuid,public.payment_method) from public;
revoke all on function public.cancel_booking(uuid) from public;
revoke all on function public.adjust_stock(uuid,integer,text) from public;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_staff() to anon,authenticated;
grant execute on function public.can_manage() to authenticated;
grant execute on function public.available_slots(uuid,uuid,date) to anon,authenticated;
grant execute on function public.create_booking(uuid,uuid,timestamptz) to authenticated;
grant execute on function public.confirm_booking_payment(uuid,public.payment_method) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.adjust_stock(uuid,integer,text) to authenticated;

-- Catálogo de demonstração: preços ilustrativos, não fornecidos pelo cliente.
insert into public.services(name,description,price_mzn,duration_minutes) values
('Tranças','Serviço de tranças',1200,120),
('Próteses capilares','Aplicação e manutenção',2500,120),
('Unhas','Manicure e aplicação',650,60),
('Maquilhagem','Maquilhagem profissional',1500,90),
('Pacote de noiva','Preparação para casamento',5500,180),
('Micropigmentação','Atendimento com preparação prévia',3500,120);
-- Profissionais e respectivos serviços devem ser configurados depois de criar as contas de teste.


-- SOURCE supabase/003_restrict_function_execution.sql
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


-- SOURCE supabase/004_auth_required_for_availability.sql
-- O MVP exige conta para marcar e consultar horários livres.
revoke execute on function public.available_slots(uuid,uuid,date) from anon;
grant execute on function public.available_slots(uuid,uuid,date) to authenticated;


-- SOURCE supabase/006_fix_public_catalog_rls.sql
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


-- SOURCE supabase/migrations/20261026102027_complete_mvp.sql
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


-- SOURCE supabase/migrations/20261026103827_tighten_hours_access.sql
drop policy hours_read on public.work_hours;
create policy hours_read on public.work_hours for select to authenticated using(
 public.current_role()='manager' or exists(select 1 from public.professionals p where p.id=professional_id and p.profile_id=auth.uid())
);
revoke insert,delete on public.salon_settings from authenticated;
