# Migração aplicada ao Supabase InfoSystems

Data: 1 de Novembro de 2026. Aplicação remota autorizada pelo pedido «aplique».

Projecto: InfoSystems-Desafio-Salao (`rslyimjlwvvgnwfohzmr`).
Migração remota: `20261101143629_multiservice_and_reschedule`.
SQL de origem: `supabase/migrations/20261101142316_multiservice_and_reschedule.sql`.

## Verificações

- Esquema, assinaturas, definições das funções e restrições remotas compatíveis com o SQL testado.
- Não existia `booking_items` nem uma migração equivalente.
- As definições anteriores das funções foram guardadas em `backend-snapshots/2026-11-01-before-multiservice.sql`. O ficheiro contém apenas definições, sem registos de clientes.
- Migração aplicada com sucesso e confirmada no histórico remoto.
- Permanecem 3 marcações e 1 pagamento. As impressões digitais agregadas dos registos antes/depois são idênticas, confirmando que o seu conteúdo não foi alterado.
- Foram criados 3 itens históricos: nenhuma reserva sem itens e nenhuma divergência entre totais/durações dos itens e da respectiva reserva.
- `booking_items` tem RLS activa. `authenticated` tem SELECT, sem INSERT/UPDATE/DELETE directos; `anon` não tem SELECT. O esquema de cálculo interno não é acessível a utilizadores autenticados.
- As quatro RPCs novas permitem execução por `authenticated`, recusam `anon` e fixam `search_path`.
- Executadas consultas de disponibilidade sob contextos SQL de Gerente/Recepção, numa transacção somente de leitura, sem erros. Isto não constitui teste de login via Supabase Auth ou de chamadas PostgREST.
- Verificadas no servidor as recusas de criação/reagendamento sem identidade autenticada. Nenhuma marcação ou pagamento de teste foi escrito na base remota.

## Avisos e limites

Os advisors não devolveram erros de segurança; mantêm avisos de funções privilegiadas autenticadas e protecção contra palavras-passe comprometidas desactivada. O aviso de funções privilegiadas passa de 11 para 14: quatro RPCs privilegiadas novas e `request_booking` passa a SECURITY INVOKER. As RPCs novas têm verificações internas de identidade/perfil e não são executáveis por visitantes anónimos.

Referências: [funções privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) e [palavras-passe comprometidas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Continuam pendentes os testes de escrita com contas de teste, concorrência entre sessões e validação completa no browser. Os 58 testes locais e a compilação da implementação anterior passaram; não foram repetidos por não haver alterações ao código funcional nesta aplicação.

A aplicação publicada não foi actualizada. Não foram feitos commits, pushes, merges ou deploy. O próximo passo é publicar o frontend integrado num alojamento com servidor Next.js e validar os fluxos completos.

Não executar `supabase db push` deste directório sobre o projecto existente: a migração de espelho é exclusiva do ambiente local vazio. A migração autorizada já está aplicada remotamente, com o identificador acima; não repetir o SQL de criação/backfill.

## Reversão

O procedimento funcional não destrutivo está em `supabase/rollback/multiservice_and_reschedule.sql`. A cópia das definições reais anteriores permite conferência antes de qualquer reversão. Não foi executado rollback.
