# Integração administrativa Bela Vida / InfoSystems

> Actualização: reagendamento e vários serviços foram implementados localmente posteriormente. Estado, migração, testes e pendências em `reagendamento-multisservicos.md`. Este documento conserva o registo da etapa anterior.

Data: 1 de Novembro de 2026. Implementação local, sem commits ou publicação.

## Estado actual

O workspace administrativo passou a carregar registos do Supabase através do servidor. A entrada continua protegida por Supabase Auth e `profiles.role`. As operações de escrita são Server Actions que voltam a validar a sessão e o perfil e usam os serviços tipados. A interface pública não foi alterada.

`seedData` continua disponível para os testes existentes, mas deixou de ser usado pelo workspace. Não existe fallback para dados fictícios se a leitura falhar.

## Funcionalidades ligadas

| Módulo | Implementado no frontend integrado | Testado |
| --- | --- | --- |
| Autenticação | Login, logout, conta e perfil do servidor | Contratos e controlo de acesso; falta login real com palavras-passe existentes |
| Clientes | Consulta/pesquisa, criação, edição, email e histórico | Persistência em respostas controladas e nova leitura |
| Serviços | Nome, descrição, preço, duração, criação/edição e activação | Contratos e limites; sem categorias inventadas |
| Profissionais | Ficha, conta já existente, activação, associações e horários por dia | Permissões e protecção conservadora de reservas futuras |
| Agenda | Dia, semana, mês, filtros e disponibilidade por RPC | Calendários, conversões de fuso horário e contrato de disponibilidade |
| Marcações | Criação pela Recepção com cliente explícito, cancelamento e início/conclusão | Serviços/RPC em ambiente controlado; não houve escritas na produção |
| Pagamentos | Registo do valor em falta, validação/rejeição, recibos e registo de reembolso já efectuado | Registo não confirma; validação confirma; estados e histórico preservados |
| Finanças | Recebimentos validados, despesas, outras receitas, reembolsos, saldo e CSV | Cálculos e persistência controlada |
| Inventário | Produtos/materiais, mínimos, preço de venda, arquivo, entradas e saídas inteiras e histórico | Quantidade só muda por RPC; recusa de stock negativo no contrato controlado |
| Definições | Prazo de reserva, política e aprovação da gerência | Leitura/actualização controladas |
| Dashboard | Contagens e valores derivados dos registos carregados | Renderização React sem dados fictícios |

As funções acima estão implementadas no código local. Isto não equivale a uma validação integral dos fluxos na produção nem a um deploy.

## Diferenças respeitadas

- A criação permite um serviço por marcação, conforme o contrato actual. Não cria várias reservas silenciosamente.
- O reagendamento está assinalado como indisponível. Não é simulado por cancelamento/criação, que quebraria o vínculo com pagamentos.
- `expired` é apresentado; `no_show` não é oferecido como operação real. Uma reserva pendente cujo prazo terminou é apresentada como expirada sem alterar a linha da base de dados.
- O registo de pagamentos não confirma a marcação. Usa `register_payment`; a validação explícita usa `validate_payment`. Não usa a confirmação antiga.
- O frontend pede o valor integral ainda em falta. A Server Action confirma esse valor com dados actuais. O backend mantém o seu contrato que permite parcelas; a alteração global para pagamento único continua pendente.
- POS só é mostrado em registos históricos; novos registos por POS não são oferecidos, respeitando a função existente.
- Inventário e finanças são reservados ao Gerente. A Recepção nem consulta as tabelas exclusivas da gerência ao carregar o workspace.
- Quantidades são inteiras. Ajustes são variações positivas/negativas, não uma substituição absoluta do saldo carregado no browser.
- Custo unitário, unidades, categorias, notas e especialidade não são apresentados como campos persistidos, porque não existem no esquema. O preço de venda não é usado como custo.
- Não é inferido um horário geral do salão a partir de dados ausentes. A disponibilidade válida vem do servidor. Pausas recorrentes continuam pendentes.
- Preços e durações das marcações são obtidos de `bookings`, preservando os valores históricos. O nome mostrado do serviço é o nome actual do catálogo; não existe um snapshot histórico desse texto no esquema actual.

## Segurança e falhas

- Não são usadas chaves secretas nem `service_role`.
- RLS continua activa; nenhuma política ou função foi alterada.
- Cada comando é autorizado no servidor. Campos como perfil, autor do pagamento ou autor da despesa não são aceites do browser para autorizar operações.
- São enviadas apenas colunas autorizadas; `quantity` não é enviada ao criar/editar produtos.
- Operações em curso bloqueiam os controlos dos formulários e são serializadas no workspace.
- Não há repetição automática de escritas. Uma perda de ligação com resultado incerto bloqueia novas operações até actualizar os dados.
- Uma escrita confirmada seguida de falha de leitura é identificada como guardada, sem voltar a submeter a escrita.
- A protecção de reservas contra alterações de horários/associações é conservadora na aplicação. Uma garantia atómica perante outros clientes concorrentes exige novas operações transaccionais no backend.
- As leituras percorrem páginas de 200 linhas com ordenação estável. Acima de 20 000 linhas por conjunto, a operação falha explicitamente em vez de apresentar totais parciais. Para volumes maiores será necessária consulta por período e agregação no servidor.

## Ficheiros principais

- `app/gestao/page.tsx`: carregamento inicial protegido.
- `app/gestao/actions.ts`: fronteira de Server Actions e disponibilidade.
- `lib/management/live-model.ts`: comandos e snapshot integrado.
- `lib/management/live-adapters.ts`: correspondência para os componentes existentes.
- `lib/management/services/workspace.ts`: leitura paginada por perfil.
- `lib/management/services/operations.ts`: autorização, validação e execução dos comandos.
- `lib/management/services/commit.ts`: separação entre escrita confirmada e actualização do ecrã.
- `components/management/workspace.tsx`: interface existente ligada às operações reais.
- `components/management/forms.tsx`: reutilização dos formulários compatíveis.
- `components/management/live-booking.tsx`: selecção dos horários efectivamente disponíveis.
- `components/management/live-panels.tsx`: adaptação dos painéis de equipa, inventário e definições aos campos persistidos.
- `components/management/operation-context.tsx` e `ui.tsx`: bloqueio dos formulários durante operações.
- `tests/live.test.mjs` e `tests/ui.test.mjs`: verificações adicionais.

## Verificação

1. TypeScript e compilação de produção passaram.
2. Testes automatizados: 40 cenários, incluindo os testes anteriores, persistência controlada, validação de pagamentos, movimentos de stock, perfis, paginação e renderização React dos dois perfis.
3. As verificações de escrita usam o SDK Supabase real com respostas HTTP controladas. Não são testes do motor PostgreSQL nem substituem testes num Supabase de staging.
4. No Supabase real foram executadas apenas consultas de leitura e transacções `READ ONLY` com papel `authenticated` e identidade de cada perfil, seguidas de `ROLLBACK`:
   - Gerente: viu os 2 clientes, 3 marcações e 2 produtos existentes.
   - Recepção: viu os 2 clientes e 3 marcações; viu zero produtos e zero despesas.
   - Não foram encontradas marcações sem correspondência de cliente, serviço ou profissional nas contagens de integridade.
5. Uma tentativa adicional de devolver registos de produção em massa foi rejeitada pela revisão automática, por ultrapassar a necessidade de inspecção e poder expor dados sensíveis. Não foi repetida nem contornada. As verificações seguintes limitaram-se a contagens agregadas e testes controlados.
6. A área pública conserva os ficheiros, estilos, fontes e imagens originais.

**Pendências de validação:** login/logout com contas reais, renovação de sessão real, testes de escrita num Supabase de staging, concorrência contra PostgreSQL, impressão e responsividade num browser. O browser remoto não alcança o servidor local nesta sessão, e não foram fornecidas palavras-passe de teste. Nenhuma palavra-passe foi alterada.

## Execução e publicação

Usar Node 22.18+, `npm ci`, `.env.local` conforme `.env.example`, `npm test`, `npm run build` e `npm start`. A configuração local contém apenas a chave pública; não acompanha o ZIP. O alojamento precisa de executar Next.js no servidor. Não usar exportação `out/`.

Não foram feitos commits, pushes, merges, migrações ou deploy. A versão publicada mantém-se inalterada. As propostas necessárias para as funcionalidades restantes estão em `proposta-backend-restante.md` e precisam de aprovação antes de execução.
