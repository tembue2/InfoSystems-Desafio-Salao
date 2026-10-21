-- Executar no SQL Editor DEPOIS de criar quatro contas de teste em /entrar.
-- Substituir TODOS os e-mails abaixo pelos endereços criados para o teste.
-- Não incluir palavras-passe neste ficheiro e não publicar credenciais reais.

update public.profiles set role='manager', full_name='Gerente (teste)'
where id=(select id from auth.users where email='GERENTE@EXEMPLO.TEST');
update public.profiles set role='reception', full_name='Recepção (teste)'
where id=(select id from auth.users where email='RECEPCAO@EXEMPLO.TEST');
update public.profiles set role='professional', full_name='Profissional A (teste)'
where id=(select id from auth.users where email='PROFISSIONAL-A@EXEMPLO.TEST');
update public.profiles set role='professional', full_name='Profissional B (teste)'
where id=(select id from auth.users where email='PROFISSIONAL-B@EXEMPLO.TEST');

insert into public.professionals(profile_id, display_name)
select id,'Profissional A' from public.profiles where full_name='Profissional A (teste)'
on conflict (profile_id) do update set display_name=excluded.display_name;
insert into public.professionals(profile_id, display_name)
select id,'Profissional B' from public.profiles where full_name='Profissional B (teste)'
on conflict (profile_id) do update set display_name=excluded.display_name;

insert into public.professional_services(professional_id,service_id)
select p.id,s.id from public.professionals p cross join public.services s
where (p.display_name='Profissional A' and s.name in ('Tranças','Próteses capilares','Pacote de noiva'))
   or (p.display_name='Profissional B' and s.name in ('Unhas','Maquilhagem','Micropigmentação'))
on conflict do nothing;

insert into public.products(name,kind,sale_price_mzn,quantity,min_quantity) values
('Champô (demonstração)','sale',450,20,5),
('Material de unhas (demonstração)','consumable',null,15,4);

-- Após executar, confirme as quatro funções e dois profissionais associados.
select id,role,full_name from public.profiles where role <> 'customer' order by role,full_name;
select p.display_name,s.name as service from public.professionals p
join public.professional_services ps on ps.professional_id=p.id
join public.services s on s.id=ps.service_id order by p.display_name,s.name;
