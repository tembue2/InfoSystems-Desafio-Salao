-- 005_demo_catalog.sql
-- Dados fictícios para validar o MVP. Não cria contas nem palavras-passe.
-- Executado no projecto Supabase InfoSystems. Idempotente.
insert into public.professionals(display_name,active)
select x.name,true
from (values ('Profissional A'),('Profissional B')) as x(name)
where not exists (select 1 from public.professionals p where p.display_name=x.name);

insert into public.professional_services(professional_id,service_id)
select p.id,s.id from public.professionals p
cross join public.services s
where (p.display_name='Profissional A' and s.name in ('Tranças','Próteses capilares','Pacote de noiva'))
   or (p.display_name='Profissional B' and s.name in ('Unhas','Maquilhagem','Micropigmentação'))
on conflict do nothing;

insert into public.products(name,kind,sale_price_mzn,quantity,min_quantity)
select x.name,x.kind::public.stock_kind,x.price,x.qty,x.minimum
from (values
  ('Champô (demonstração)','sale',450.00,20,5),
  ('Material de unhas (demonstração)','consumable',null::numeric,15,4)
) as x(name,kind,price,qty,minimum)
where not exists(select 1 from public.products p where p.name=x.name);
