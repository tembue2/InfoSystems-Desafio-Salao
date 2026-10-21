# InfoSystems — Sistema de Gestão de Salão de Beleza

**Fase 2, entrega inicial (protótipo local)** · Next.js / TypeScript / Supabase PostgreSQL.

Aplicação de demonstração para o desafio técnico confidencial. **Não é uma versão completa nem foi publicada**. Não colocar dados pessoais reais ou credenciais de testes em repositórios públicos.

## Funcionalidades já codificadas

- Registo e início de sessão por e-mail com Supabase Auth.
- Lista de serviços e profissionais associados.
- Consulta de horários disponíveis, de segunda a sábado, 08h–17h, fuso horário de Maputo.
- Pedido de reserva com bloqueio transaccional de horários sobrepostos.
- Pré-reserva de 60 minutos, pendente até pagamento integral validado manualmente.
- Painel da equipa para registar pagamento integral e confirmar reserva no mesmo acto.
- Consulta e cancelamento de reservas pela cliente (política de 24h).
- Tabelas e regras de acesso para despesas, produtos e movimentos de stock; função transaccional para ajustar inventário.

**Ainda a implementar nesta fase:** gestão completa de serviços/equipa e stock na interface; registo de venda de produtos e reconciliação; relatórios financeiros diários/mensais; recibo imprimível; estados adicionais de prestação de serviço; teste automatizado; testes reais e deploy. Os dados de preços do catálogo são ilustrativos, não definidos pela InfoSystems.

## 1. Configuração local

1. Instalar Node.js 20 ou superior.
2. Clonar este repositório e executar `npm install`.
3. Criar projecto separado de **testes** no Supabase.
4. No **SQL Editor**, executar integralmente `supabase/001_initial.sql` uma vez num projecto limpo.
5. Copiar `.env.example` para `.env.local` e substituir URL e chave pública do projecto (nunca `service_role`).
6. Executar `npm run dev` e abrir `http://localhost:3000`.
7. Através de **Conta**, criar quatro contas internas de teste e uma conta de cliente. Se a confirmação de e-mail estiver ligada no Supabase Auth, confirmar os e-mails antes de iniciar sessão.
8. Substituir os quatro e-mails de exemplo em `supabase/002_demo_configuration.sql` e executar esse script no SQL Editor com privilégios de administrador.
9. Abrir **Reservar** com a conta de cliente e **Gestão** com a conta de gerente ou recepção.

### Contas de teste sugeridas

Gerente (1), recepção (1), profissionais (2), **mais** uma conta de cliente para simular marcações externas. Esta distribuição dos quatro funcionários é uma decisão do MVP, não foi imposta pelo cliente.

## 2. Regras essenciais

- A aplicação **não cobra online**. O pagamento pode ser efectuado fora do sistema (numerário/carteira móvel) e tem de ser **efectivamente verificado** pela equipa antes de clicar em `Validar pagamento`.
- A validação regista exactamente o valor integral do serviço, cria um pagamento e confirma a marcação numa única transacção da base de dados.
- A duração base é estimada por serviço; a criação de reservas usa o período integral e rejeita conflitos mesmo com duas submissões simultâneas. A edição individual da duração pela equipa será concluída noutra etapa.
- Pré-reservas expiram após **60 minutos**, uma decisão de demonstração a validar operacionalmente (sem pagamentos digitais integrados).
- Cancelamentos feitos pela própria cliente até 24 horas antes podem gerar um reembolso a processar **manualmente**; cancelamentos mais tardios exigem intervenção da equipa.
- Dias de abertura não foram definidos pela InfoSystems: nesta implementação assumimos **segunda a sábado** e encerramento ao domingo.
- Os estados de reservas pendentes expiradas só são actualizados no banco quando uma nova reserva do mesmo profissional é criada; disponibilidade trata-as como expiradas mesmo antes dessa actualização. Para produção seria necessário job de limpeza.
- Só podem ser criadas reservas com sessão autenticada (reduz abuso de pré-reservas públicas).
- Os dados e serviços do catálogo são de demonstração; devem ser confirmados antes de qualquer uso real.

## 3. Segurança

- Todos os dados privados estão protegidos por **Row Level Security**.
- Cliente só lê as suas próprias reservas; pagamentos são visíveis à gerência e recepção.
- Cliente não consegue alterar o próprio perfil de permissões: apenas nome, telefone e data de nascimento.
- O browser só utiliza a chave pública (`anon` / publishable); **nunca expor a service_role key**.
- Funções SQL privilegiam autenticação, validação de estado, transacções e confirmação no banco de dados.
- Não expor credenciais reais, dados pessoais ou ficheiros `.env.local` no GitHub.

## 4. Comandos

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

**Limitação de verificação nesta entrega:** o ambiente de execução disponível não tinha as dependências npm em cache, pelo que não foi possível efectuar `npm install`, `npm run typecheck` e `npm run build` localmente. O SQL não foi executado num projecto Supabase; os testes integrados precisam de credenciais de um projecto de testes.

## 5. Documentos técnicos

- `docs/01_modelo_de_dados_e_permissoes.md`
- `docs/02_criterios_de_aceitacao.md`
- `docs/03_plano_fase2.md`
- `supabase/001_initial.sql` — esquema, políticas e funções seguras
- `supabase/002_demo_configuration.sql` — configuração de contas e catálogo ilustrativo

## 6. Publicação

Após testes locais: ligar o repositório à Vercel, configurar as duas variáveis públicas e publicar. Testar separadamente acesso de clientes, da equipa e permissões de cada função.
