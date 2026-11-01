# Integração Bela Vida / InfoSystems — Fase 2

Data: 1 de Novembro de 2026. Base do frontend: `d17d4c1a947ad4c94b4afcc2e56aa1019f7f4eb3`.
Backend inspeccionado: `InfoSystems-Desafio-Salao` (`rslyimjlwvvgnwfohzmr`).

## Resultado e limites

Foi criada a camada modular de acesso ao Supabase e implementada a entrada autenticada na gestão. **Os módulos operacionais continuam em demonstração explícita.** Não estão ligados aos novos serviços e não persistem alterações. Não existe fallback de dados reais para fictícios.

A página pública, os seus componentes, estilos, fontes e imagens foram preservados. O acesso a `/gestao/` passa pela validação de identidade no servidor e pela consulta de `profiles.role`. A selecção livre de perfil foi retirada. A demonstração usa apenas o perfil autorizado da conta autenticada.

Não foram feitas alterações ao esquema, funções, políticas RLS, contas, palavras-passe ou configuração remota. Não houve commits, pushes, merges ou deploy.

## Ficheiros e responsabilidades

| Caminho | Responsabilidade |
| --- | --- |
| `lib/supabase/database.types.ts` | Tipos gerados a partir da base de dados actual; não equivalem a uma migração |
| `lib/supabase/config.ts` | Validação do URL e da chave pública publishable; rejeita chaves secretas |
| `lib/supabase/client.ts` | Cliente do browser com cookies, sem privilégios administrativos |
| `lib/supabase/server.ts` | Cliente por pedido, com cookies; restrito ao servidor |
| `proxy.ts` | Renovação de sessões apenas em `/gestao/*`; respostas privadas sem cache |
| `lib/management/access.ts` | Identidade validada por `getUser()` e autorização por `profiles.role` |
| `lib/management/errors.ts` | Erros normalizados sem detalhes internos da base de dados |
| `lib/management/validation.ts` | Identificadores, datas com fuso horário, montantes e texto |
| `lib/management/adapters.ts` | Registos reais separados dos modelos fictícios; conversões explícitas |
| `lib/management/use-resource.ts` | Carregamento, erro, actualização e descarte de respostas antigas; preparado para os módulos seguintes |
| `lib/management/services/*` | Serviços tipados com cliente injectado e verificação de perfil |
| `app/gestao/entrar/*` | Login por email/palavra-passe e logout através de Server Actions |
| `app/gestao/page.tsx` | Protecção da área administrativa no servidor |
| `components/management/entry.tsx` | Reutilização da apresentação original de entrada |
| `components/management/login.tsx` | Formulário de login, erros e envio em curso |
| `components/management/workspace.tsx` | Perfil obtido do servidor; módulos ainda demonstrativos |
| `next.config.ts` | Remoção da exportação estática, necessária para executar autenticação no servidor |

`loading.tsx` e `error.tsx` tratam o carregamento e falhas da área de gestão. As dependências Supabase foram fixadas: `@supabase/ssr` 0.12.7 e `@supabase/supabase-js` 2.118.0.

## Serviços preparados

| Serviço | Operações disponíveis no código | Estado na interface |
| --- | --- | --- |
| Clientes | Listagem paginada/pesquisa por nome, criação e actualização de colunas autorizadas | Demonstração |
| Catálogo | Consulta, criação e actualização; limite de duração de 480 minutos | Demonstração |
| Profissionais | Consulta, ficha, horários para Gerente e associação de serviços | Demonstração |
| Marcações | Consulta paginada por período, disponibilidade, criação com cliente explícito, cancelamento e transições suportadas | Demonstração |
| Pagamentos | Consulta, registo separado da validação | Demonstração |
| Finanças | Resumo com outras receitas/reembolsos e registo de despesas pelo Gerente | Demonstração |
| Inventário | Consulta, histórico paginado e variações inteiras através de `adjust_stock`, apenas Gerente | Demonstração |
| Definições | Consulta das políticas operacionais pelo Gerente | Demonstração |

Os serviços não expõem CRUD genérico nem recebem uma chave `service_role`. RLS e as funções de negócio continuam a decidir as operações autorizadas. A verificação de perfil nos serviços é adicional, não substitui RLS.

Os registos reais preservam nulos e estados como `expired`. Campos inexistentes (notas, categorias, especialidade, custo e unidade) não são inventados. A chamada antiga `confirm_booking_payment` não é usada. Os serviços de pagamentos mantêm o contrato actual do backend, incluindo a possibilidade de parcelas; a alteração para pagamento único continua pendente.

## Execução local

1. Usar Node 22.18 ou superior.
2. Executar `npm ci`.
3. Criar `.env.local` com as variáveis de `.env.example`, usando o URL do projecto InfoSystems e a sua chave **publishable**.
4. Executar `npm run build` e `npm start`, ou `npm run dev:next` para desenvolvimento.
5. Abrir `/gestao/entrar/` com uma conta existente de Recepção ou Gerente.

As variáveis `NEXT_PUBLIC_*` são públicas por definição. Nunca colocar aí chaves secretas ou `service_role`. A configuração local não é incluída na entrega de código. Alterações às variáveis públicas exigem nova compilação.

A aplicação já não gera `out/`. O alojamento precisa de suportar servidor Next.js. A página `/` continua pré-renderizada e não passa pelo proxy de autenticação. Nenhuma configuração de alojamento remoto foi alterada.

## Verificação executada

- `npm run typecheck`: passou.
- `npm run build`: passou; `/` estática, `/gestao` e `/gestao/entrar` dinâmicas.
- `npm test`: 26 testes passaram (11 existentes e 15 novos).
- Os testes novos usam o SDK real com respostas HTTP controladas; não escrevem na base de dados.
- Cobertura nova: perfil vindo de `profiles` em vez de metadados editáveis, recusa de clientes e da Recepção em operações do Gerente, sessão inválida, colunas permitidas, limites de duração, criação pela Recepção, recusa de múltiplos serviços, separação registo/validação, métodos/estados não suportados, quantidades inteiras, finanças, falhas de rede e rejeição de chaves secretas.
- Verificação HTTP local: `/` responde 200 com o conteúdo público; `/gestao/entrar/` mostra email/palavra-passe sem selector de perfil; `/gestao/` sem sessão não envia o workspace protegido e emite redireccionamento para a entrada.
- Por existir `loading.tsx`, o redireccionamento do Next.js pode ocorrer em streaming: HTTP 200 com `meta refresh` e instrução de redireccionamento, sem o conteúdo protegido. As respostas da gestão são `private, no-store`.
- Consulta de leitura no Supabase real com a chave publishable e sem sessão: `profiles` devolveu zero registos, sem erro. Nenhuma escrita foi executada. Esta verificação não substitui testes RLS por perfil.
- Os 14 ficheiros públicos, incluindo fontes e imagens, permanecem idênticos ao original.

**Não verificado:** login/logout com contas reais (palavras-passe não disponíveis), políticas RLS executadas como cada perfil, renovação real de tokens, persistência dos módulos e concorrência. Não foi criado um ambiente de testes Supabase nem foram alteradas contas de produção.

A verificação visual no browser ficou limitada: o browser remoto não alcançou o servidor local, e o runtime Playwright local não tem o executável Chromium instalado. Não se afirma validação visual desta alteração.

## Próxima implementação sem alteração de backend

1. Validar autenticação com as contas existentes num ambiente controlado.
2. Ligar Clientes, Catálogo e consulta de Profissionais aos serviços preparados, usando `useManagementResource` com um loader estável.
3. Depois de cada escrita confirmada, chamar `refresh()`. Uma falha de actualização deve ser apresentada sem repetir automaticamente a escrita.
4. Tratar submissões em curso, duplicados, erros e paginação no módulo respectivo.
5. Validar persistência antes de retirar os dados fictícios desse módulo.

Consultas de catálogo e profissionais ainda não implementam uma interface de paginação. Antes de produção, adaptar a listagem ao volume e ao limite de resposta do Supabase. Não usar resultados parciais para indicadores globais.

## Propostas de backend ainda não executadas

| Necessidade | Proposta a detalhar antes de execução | Risco / impacto | Reversão |
| --- | --- | --- | --- |
| Reagendamento | RPC transaccional, bloqueio do profissional e verificação de conflitos; preservar ID, pagamentos e valores | Corridas e alteração indevida de reservas pagas | Retirar o novo ponto de entrada; preservar reservas e histórico |
| Vários serviços | Definir uma extensão compatível ao modelo, com valores/durações históricos por serviço | Impacto em disponibilidade, pagamentos, recibos e reservas existentes | Manter compatibilidade com reservas de um serviço; não eliminar estruturas/dados antigos |
| Pagamento único | Exigir o montante integral numa operação, mantendo validação de recebimento | Pagamentos parciais já existentes precisam de tratamento | Restaurar a função anterior, sem eliminar pagamentos |
| Pausas e horário geral | Representar pausas recorrentes e horário do salão sem simular ausências infinitas | Mudanças podem afectar reservas futuras | Preservar horários anteriores e permitir restaurá-los |
| Consumo pela Recepção | Permissão específica de consumo negativo, sem gestão de catálogo/entradas | Ampliação de acesso; exige nova avaliação RLS/RPC | Revogar a operação específica e restaurar as políticas anteriores |
| Stock fraccionado e ajuste absoluto | Decidir unidades/precisão; operação atómica para contagem física | Conversão de quantidades e auditoria | Preservar valores originais e impedir conversões com perda |
| Campos adicionais | Reutilizar as tabelas existentes com colunas mínimas justificadas | Compatibilidade com formulários e dados antigos | Desactivar uso dos novos campos sem eliminar dados |
| Não comparência | Decidir estado/transição próprios; não converter para cancelamento | Impacto em histórico e relatórios | Desactivar a transição mantendo o histórico existente |

Estas propostas não são migrações prontas nem autorização para executar alterações. Os contratos, impacto, testes e reversão serão apresentados em detalhe antes de aplicar qualquer uma.
