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
