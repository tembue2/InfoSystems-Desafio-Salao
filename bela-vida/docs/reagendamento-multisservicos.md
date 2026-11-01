# Reagendamento e marcações com vários serviços

Data: 1 de Novembro de 2026. Implementação autorizada pelo pedido «implementar reagendamento e marcações com vários serviços».

**Actualização:** a migração foi posteriormente aplicada ao Supabase InfoSystems após o pedido «aplique». Ver `migracao-aplicada.md` para os resultados remotos. Sem commits ou deploy. As secções abaixo conservam os resultados e limites da preparação local.

## Resultado

O formulário existente permite seleccionar de 1 a 20 serviços distintos. Apresenta a duração e o preço totais e apenas profissionais activos associados a todos os serviços. Os serviços são consecutivos e realizados pelo mesmo profissional, numa única reserva. A ordem dos itens corresponde à ordem de selecção.

O detalhe de uma reserva pendente válida ou confirmada permite reagendar. A operação altera exclusivamente profissional, início, fim e data de actualização. Conserva ID, cliente, estado, prazo de pagamento, serviços, preços, duração contratada e pagamentos. Os serviços e o cliente não são editáveis durante o reagendamento. O backend recusa reservas expiradas, canceladas, em atendimento ou concluídas.

A disponibilidade usa a duração total e, no reagendamento, exclui a própria reserva. São verificadas associações, serviços activos, horário laboral, ausências, horizonte de 60 dias e conflitos. A confirmação continua dependente da validação do pagamento. Não foi alterada a regra de pagamentos parciais existente no backend.

## Ficheiros principais

| Ficheiro | Alteração |
| --- | --- |
| `supabase/migrations/20261101142316_multiservice_and_reschedule.sql` | SQL aditivo, preenchimento histórico, RLS e RPCs novas; compatibilidade com `request_booking` |
| `supabase/rollback/multiservice_and_reschedule.sql` | Reversão funcional sem apagar reservas, itens ou pagamentos |
| `lib/supabase/database.types.ts` | Contratos TypeScript adicionais da migração proposta; regenerar a partir de staging quando aplicada |
| `lib/management/services/bookings.ts` | Criação com vários serviços, disponibilidade e reagendamento |
| `lib/management/services/operations.ts` | Novo comando e verificação de associações considerando todos os itens |
| `lib/management/services/workspace.ts` | Carregamento paginado dos itens, sujeito a RLS |
| `lib/management/live-adapters.ts` | Projecção de itens históricos e recusa de totais/durações inconsistentes |
| `components/management/live-booking.tsx` | Selecção múltipla e formulário de reagendamento com estados assíncronos |
| `components/management/workspace.tsx` | Acção de reagendamento e actualização dos dados após escrita |
| `app/gestao/actions.ts` | Fronteira de servidor autenticada para as consultas |
| `tests/booking-database.test.mjs` | Execução SQL em PostgreSQL WASM isolado (PGlite), incluindo RLS e rollback |
| `scripts/staging/smoke.mjs` | Fluxo de testes reais preparado para dois serviços e reagendamento pago |

## Contratos de backend

- `available_booking_slots(p_services uuid[], p_professional uuid, p_day date)` devolve horários para a duração total.
- `request_booking_services(p_services uuid[], p_professional uuid, p_starts_at timestamptz, p_client uuid default null)` cria uma reserva e os seus itens atomicamente.
- `available_reschedule_slots(p_booking uuid, p_professional uuid, p_day date)` usa a duração histórica, excluindo a própria reserva. Apenas Gerente/Recepção.
- `reschedule_booking(p_booking uuid, p_professional uuid, p_starts_at timestamptz)` preserva o contrato da reserva. Apenas Gerente/Recepção.
- `request_booking` mantém assinatura e retorno para clientes antigos; delega a criação de um item à nova operação.
- `available_slots` e `create_booking` conservam os contratos antigos de um serviço. Os conflitos continuam a usar o intervalo total em `bookings`.

`booking_items` é uma relação necessária para os serviços efectivamente contratados; `professional_services` representa qualificações da equipa e não pode guardar esses itens. A estrutura auditada não contém uma relação equivalente. Cada item guarda posição, serviço, nome, preço e duração. O preenchimento inicial usa os valores contratados de `bookings`, sem recalcular o preço ou a duração pelo catálogo. O nome histórico anterior não é recuperável: o preenchimento usa o nome actual do serviço. Durações antigas com segundos fazem a migração abortar para revisão, em vez de serem arredondadas.

A RLS dos itens herda a visibilidade da reserva. Os perfis autenticados têm apenas SELECT; escritas ocorrem nas operações transaccionais. As funções públicas verificam a identidade, restringem chamadas anónimas e fixam `search_path`. O cálculo interno de disponibilidade está num esquema sem acesso de clientes.

O reagendamento usa um bloqueio por reserva, seguido dos bloqueios dos profissionais ordenados pelo identificador do bloqueio, e só então bloqueia a linha. `validate_payment` adquire o mesmo bloqueio de reserva antes do bloqueio do profissional. Isso coordena o reagendamento com a validação e com as criações antigas/novas. A lógica financeira dessa função foi preservada.

## Validação executada

- `npm test`: **58 passaram; 0 falharam**, incluindo 9 cenários SQL numa instância PostgreSQL WASM em memória.
- `npm run typecheck`: passou.
- `npm run build`: passou; área pública pré-renderizada e gestão com execução no servidor.
- Comparação byte a byte: **14 ficheiros públicos idênticos** ao original, incluindo estilos, fontes e imagens.

Os testes SQL executam o esquema auditado e a migração real com dados fictícios. Cobrem preenchimento histórico, API antiga, múltiplos serviços, totais/duração, associações, limites de horário, ausências, conflitos, preservação de pagamentos, reagendamento sem alteração, auditoria, expiração, estados, RLS, privilégios de funções e reversão. A fixture reproduz os papéis e `auth.uid()` em SQL; não executa o serviço Supabase Auth.

Os testes de aplicação verificam os contratos RPC, projecção histórica, recusa de totais inconsistentes e renderização do formulário. As falhas das operações mantêm o diálogo aberto; o mecanismo existente impede repetição automática de escritas com resultado incerto.

## Limites e activação

O Supabase remoto e o site publicado permanecem inalterados. A alteração de esquema foi executada apenas na base descartável dos testes. O comando de smoke para Supabase está preparado, mas não foi executado nesta alteração.

Ainda é necessário validar num Supabase isolado com contas de teste: autenticação completa, chamadas PostgREST, concorrência entre sessões, corrida reagendamento/validação/criação, impressão e interacção no browser em desktop e mobile. PGlite executa PostgreSQL, mas usa uma sessão e não comprova concorrência entre ligações. A revisão visual interactiva não foi executada.

Antes de produção, comparar o esquema remoto com o espelho auditado e guardar as definições efectivas de `request_booking` e `validate_payment`. Aplicar **somente a migração nova** ao projecto existente; a migração `mirror_infosystems_for_local_tests` destina-se exclusivamente a uma base local vazia. Aplicar primeiro a migração em staging e depois a versão da aplicação que lê `booking_items`; esta versão falha de forma explícita se a tabela ou as RPCs não existirem. Não usar dados fictícios como alternativa a falhas de backend.

Alterações concorrentes de horários/associações continuam sujeitas à limitação já documentada: as operações antigas de gestão dessas estruturas não partilham os bloqueios transaccionais das reservas. As respectivas RPCs atómicas pertencem à proposta separada, ainda não implementada. Não foi ampliado o acesso da Recepção a inventário, finanças ou definições.

## Reversão

O ficheiro `supabase/rollback/multiservice_and_reschedule.sql` foi testado na base descartável. Deve ser executado com as escritas temporariamente suspensas. Revoga criação multi-serviço e reagendamento, restaura as funções antigas de criação e validação e instala um trigger que mantém um item histórico para as novas reservas criadas pela API antiga. Nenhuma reserva, item ou pagamento é apagado.

Manter uma interface que consiga consultar todos os itens de reservas já criadas. O frontend novo perde temporariamente as operações de criação e reagendamento, por usar as RPCs revogadas; o endpoint antigo de criação de um serviço continua funcional. Não regressar a uma interface que apresente silenciosamente apenas o primeiro serviço de uma reserva múltipla.

Para reactivar, retirar o trigger de compatibilidade do rollback, restaurar as definições novas das funções alteradas e os seus privilégios. Não repetir a criação da tabela nem o preenchimento histórico sobre itens existentes.
