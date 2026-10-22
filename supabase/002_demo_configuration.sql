-- 002_demo_configuration.sql
-- Executar SÓ DEPOIS de criar as cinco contas de teste em Supabase Auth:
-- gerente, recepção, profissional A, profissional B e uma cliente.
-- Substituir os e-mails de exemplo abaixo pelos e-mails reais de TESTE
-- que estejam presentes em Auth > Users. Nunca incluir palavras-passe.
-- O perfil da cliente mantém a função 'customer'.

update public.profiles set role='manager', full_name='Gerente (teste)'
where id=(select id from auth.users where lower(email)=lower('GERENTE@EXEMPLO.TEST'));
update public.profiles set role='reception', full_name='Recepção (teste)'
where id=(select id from auth.users where lower(email)=lower('RECEPCAO@EXEMPLO.TEST'));
update public.profiles set role='professional', full_name='Profissional A (teste)'
where id=(select id from auth.users where lower(email)=lower('PROFISSIONAL-A@EXEMPLO.TEST'));
update public.profiles set role='professional', full_name='Profissional B (teste)'
where id=(select id from auth.users where lower(email)=lower('PROFISSIONAL-B@EXEMPLO.TEST'));

-- Associa os utilizadores aos profissionais de demonstração JÁ existentes.
-- Não duplica registos de profissionais.
update public.professionals p set profile_id=u.id
from auth.users u
where p.display_name='Profissional A'
  and lower(u.email)=lower('PROFISSIONAL-A@EXEMPLO.TEST');
update public.professionals p set profile_id=u.id
from auth.users u
where p.display_name='Profissional B'
  and lower(u.email)=lower('PROFISSIONAL-B@EXEMPLO.TEST');

-- Conferir resultados: quatro colaboradores e uma conta de cliente.
select role,count(*) as contas from public.profiles group by role order by role;
select display_name,profile_id is not null as conta_associada
from public.professionals order by display_name;
