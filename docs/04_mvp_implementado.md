# MVP — implementação e validação

Referência funcional: documento «PROMPT MASTER — SISTEMA DE GESTÃO DE SALÃO DE BELEZA», recebido em 26/10/2026. Esta versão mantém Next.js App Router, TypeScript, Supabase Auth/PostgreSQL, GitHub e Vercel; acrescenta Tailwind CSS 4 sem substituir os estilos aprovados. Tailwind/PostCSS são dependências de compilação. A versão do cliente Supabase está fixada no lockfile e package.json.

## Módulos

| Módulo | Implementação |
|---|---|
| Acesso | Encaminhamento por perfil; navegação autorizada; ecrã de acesso negado; pedido e conclusão de recuperação de palavra-passe; perfil editável; saída |
| Serviços | Nome, descrição, preço, duração e estado; desactivação conserva histórico |
| Profissionais | Registo, edição, activação, associação opcional a conta existente com perfil Profissional; associação de serviços |
| Clientes | Registo presencial sem conta Auth, edição, pesquisa paginada, histórico e pagamentos associados; sincronização de nome/telefone dos perfis online |
| Horários | Semana configurável por profissional, indisponibilidades, horários em Africa/Maputo |
| Marcações | Catálogo, profissional, disponibilidade, reserva online ou pela recepção, agenda diária, filtros, estados operacionais |
| Pagamentos | Registo parcial/integral separado de validação, rejeição, referência, responsáveis, histórico de auditoria; sem gateway/POS |
| Recibos | Recibo de pagamento validado, impressão pelo navegador, identificação de reembolso |
| Finanças | Resumos diários/mensais e intervalo livre, receitas validadas, outras receitas, despesas e reembolsos; gráfico de composição |
| Inventário | Produtos de venda e consumíveis, entradas/saídas com motivo, saldo transaccional, histórico, alertas de stock baixo |
| Definições | Prazo de pré-reserva e texto de condições, aprovação pela gerência, últimas alterações |

## Regras e decisões pendentes

- Prazo inicial de pré-reserva **60 minutos**, herdado do sistema anterior e identificado como provisório. A alteração nas definições afecta apenas novas reservas. Pagamentos em verificação não prolongam esse prazo. A disponibilidade ignora reservas expiradas mesmo sem uma tarefa periódica; o frontend mostra «Expirada».
- O estado «Pagamento em verificação» é calculado a partir dos pagamentos pendentes. A marcação mantém `pending_payment` até a soma validada atingir o valor integral. Não se aceita valor superior ao devido nem validação repetida.
- Horários iniciais 08h–17h de segunda a sábado foram copiados para os profissionais existentes para preservar comportamento. Novos profissionais necessitam de configuração própria.
- Reembolsos não têm percentagens ou prazos inventados. Cliente com pagamento registado deve contactar a recepção. A gerência pode registar um reembolso integral de um pagamento validado em reserva cancelada/expirada, com motivo. Não existe envio automático de dinheiro. Sinalizações antigas de `refund_due` são preservadas.
- Pagamentos de marcações constituem a fonte única das receitas de serviços. `manual_income` destina-se a outras origens; a interface avisa para não duplicar pagamentos de marcações. Despesas e outras receitas são registos de lançamento, sem edição silenciosa.
- Os resumos são agregados no PostgreSQL, sem limites de paginação. Listas extensas: gestão paginada de 25 linhas; pagamentos mostram as últimas 100 marcações com acesso às outras pela agenda; histórico financeiro mostra até 200 movimentos por origem e indica esse limite; auditoria mostra as últimas 50 alterações.
- O catálogo existente contém preços de demonstração anteriores; a gerência deve rever os valores antes de utilização comercial.
- A criação de contas internas e a atribuição de funções continuam a exigir administração autorizada. O módulo Profissionais associa contas já classificadas como Profissional.

## Segurança e migração

As migrações em `supabase/migrations` acrescentam tabelas/campos, preservam os dados e mantêm RLS. A antiga `confirm_booking_payment` deixa de ser executável por clientes autenticados. As operações de reserva, pagamento, cancelamento, estado e stock são transaccionais e autorizadas no servidor; ocultar botões é apenas uma medida de interface.

As funções RPC privilegiadas são pontos de entrada intencionais, com verificação de identidade/função e `search_path` fixo. O advisor continua a sinalizar a sua execução por utilizadores autenticados; a advertência foi revista e não substitui os testes de autorização. A protecção de palavras-passe comprometidas da configuração Auth continua desactivada; não foi alterada nesta implementação.

Os gatilhos internos de auditoria/sincronização ficam no esquema `private`, sem acesso directo. `clients` separa clientes presenciais de contas Auth e conserva a ligação opcional ao perfil.

## Testes

- `npm run typecheck` e `npm run build`.
- `tests/database.sql`: teste transaccional com **ROLLBACK** obrigatório já incluído. Cria fixtures somente dentro da transacção e testa os quatro perfis, isolamento de dados, sobreposição, pagamentos parciais/integral, validação duplicada, estados, stock, auditoria, horários, indisponibilidades e agregação financeira.
- `tests/browser.mjs`: teste visual com respostas de API simuladas, separado da evidência de execução real no PostgreSQL. Verifica desktop/telemóvel, acesso por perfil, formulário e recibo. Requer Playwright disponível e Chromium (`QA_CHROMIUM_PATH` opcional). Usa a configuração pública Supabase do projecto e não grava dados reais.
- Após autorização, foram criadas quatro contas temporárias e verificado o login real no site de produção, encaminhamento e acesso por perfil (gerente, recepção, profissional e cliente), incluindo apresentação móvel. Os quatro perfis passaram sem erros JavaScript.
- Duas chamadas HTTP concorrentes para o mesmo profissional e horário: exactamente uma reserva aceite e uma rejeitada. Registo de pagamento manteve a reserva pendente; validação integral confirmou. O profissional concluiu o atendimento e não conseguiu consultar pagamentos. Stock insuficiente foi rejeitado sem alterar o saldo.
- Contas, sessões e registos temporários foram eliminados após os testes. Confirmado: zero contas/serviços/profissionais/produtos/marcações de teste remanescentes; as duas marcações anteriores foram preservadas.
- Compilação e 46 verificações visuais com API simulada aprovadas. Deploy de produção READY, commit b15bcf3 (PR #3), em https://infosystems-desafio-salao.vercel.app.
- Recuperação de palavra-passe por e-mail não foi testada de ponta a ponta: depende da configuração Auth/SMTP e de um endereço de recepção válido.

## Operação

1. Entrar com a conta da equipa; o sistema encaminha para `/admin`.
2. Gerente: rever serviços, profissionais habilitados, horários, preços e políticas.
3. Cliente: escolher serviço em `/catalogo`, criar reserva e contactar o salão para pagar.
4. Recepção: abrir marcação em Agenda → Pagamentos; registar o montante e referência, depois validar o recebimento. Pagamentos parciais não confirmam.
5. Profissional: consultar a agenda, iniciar atendimento e concluir.
6. Gerente: consultar Finanças, lançar despesas e movimentar inventário.

Na configuração Auth, o endereço `/recuperar` do domínio de produção deve ser permitido como URL de redireccionamento. A entrega de e-mails depende do SMTP/configuração Auth existente.
