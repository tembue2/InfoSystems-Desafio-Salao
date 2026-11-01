# Alterações de backend propostas — estado por âmbito

Os pontos 1 e 2 foram autorizados e implementados localmente; ver `reagendamento-multisservicos.md` e o SQL exacto da migração. A migração dos pontos 1 e 2 foi posteriormente aplicada ao Supabase InfoSystems, com autorização «aplique»; ver `migracao-aplicada.md`. Os restantes pontos continuam pendentes. O objectivo é completar os fluxos do frontend sem eliminar reservas, pagamentos ou estruturas existentes.

## 1. Reagendamento — prioridade alta

**Contrato proposto:** `reschedule_booking(p_booking uuid, p_professional uuid, p_starts_at timestamptz)`.

- Apenas Gerente/Recepção, verificados na própria função pela identidade autenticada e `profiles`.
- Aceitar apenas reservas pendentes dentro do prazo ou confirmadas. Não reabrir reservas expiradas/canceladas nem mover atendimentos concluídos.
- Bloquear a reserva e os profissionais antigo/novo numa ordem determinística. A criação e a validação de pagamentos existentes já usam bloqueio por profissional; a operação nova deve coordenar-se com esse bloqueio.
- Verificar serviço activo, associação ao profissional, horário, ausências, horizonte permitido e conflitos, excluindo a própria reserva.
- Preservar o ID, cliente, preço, duração contratada, estado, prazo e pagamentos existentes. Não recalcular o preço pelo catálogo actual.
- Alterar apenas profissional, início/fim e `updated_at`, na mesma transacção; manter o trigger de auditoria.
- Rejeitar conflitos sem deixar alterações parciais. Permitir reenvio para a mesma posição como operação sem alteração.

**Riscos:** corridas, deadlocks e perda de disponibilidade; mitigados por bloqueios compatíveis, ordenação determinística e testes de concorrência em staging. A duração histórica pode diferir da duração actual do catálogo; a verificação deve usar a duração da reserva.

**Reversão:** retirar o botão integrado e revogar a execução da nova função. Não apagar nem recriar reservas reagendadas. Preservar auditoria e cópia da definição anterior das funções afectadas.

## 2. Vários serviços — prioridade alta

**Proposta:** reutilizar `bookings` como reserva e acrescentar itens de serviço ligados à reserva, com ordem, serviço, nome, preço e duração históricos. Manter o `service_id` actual como compatibilidade para clientes antigos de um serviço durante a transição.

A tabela de associações `professional_services` não representa serviços efectivamente contratados e não pode ser reutilizada para guardar estes itens. Uma relação específica de itens só deve ser criada após confirmar que não surgiu outra estrutura equivalente.

- Preencher itens das reservas existentes a partir do serviço associado e dos preços/durações históricos já guardados em `bookings`.
- Criar uma RPC adicional para criação com vários serviços, validando todas as associações e a duração total, com bloqueio único por profissional.
- A reserva continua a ter um total e um pagamento integral; não criar várias reservas independentes para simular o conjunto.
- Adaptar disponibilidade e reagendamento para duração total, mantendo os contratos antigos enquanto forem necessários.
- Aplicar RLS aos itens através da permissão da reserva; escritas apenas pelas operações transaccionais autorizadas.

**Riscos:** impacto em disponibilidade, recibos e clientes antigos; alterações devem ser aditivas, primeiro em staging, com testes de regressão dos contratos existentes.

**Reversão:** parar a utilização das RPCs novas e voltar ao fluxo de um serviço sem apagar os itens já registados. Não reduzir silenciosamente reservas multi-serviço para um único serviço; mantê-las consultáveis e bloquear alterações enquanto a versão compatível não for restaurada.

## 3. Pagamento único no próprio backend — prioridade alta

- Alterar `register_payment` para exigir o total devido numa única operação para reservas novas.
- Manter o bloqueio da reserva e a validação separada de recebimento.
- Preservar pagamentos parciais históricos; definir previamente como liquidar o remanescente desses casos.
- Manter os campos de referência, validação e reembolso e nunca eliminar pagamentos rejeitados.

**Riscos:** clientes antigos podem enviar parcelas e passar a receber erro. **Reversão:** restaurar a definição anterior da função; todos os pagamentos permanecem registados.

## 4. Alterações de horários e associações com garantia atómica

- Encapsular mudanças de horário, activação e retirada de associações em RPCs do Gerente, usando os mesmos bloqueios por profissional.
- Rejeitar uma mudança que invalide reservas futuras/atendimentos activos.
- Representar pausas recorrentes e horário geral nas estruturas existentes sempre que possível; propor colunas mínimas e validações antes de as acrescentar.

**Riscos:** capacidade e disponibilidade alteradas perante reservas concorrentes. **Reversão:** revogar as novas RPCs e restaurar as definições/políticas anteriores, sem apagar horários ou reservas.

## 5. Extensões opcionais

- **Não comparência:** novo estado e transição, sem substituir cancelamentos nem alterar pagamentos automaticamente.
- **Recepção no inventário:** operação específica de consumo, sem entradas, ajustes positivos, catálogo ou finanças. Exige aprovação explícita de ampliação de permissões; não será concedida por consequência das outras alterações.
- **Stock fraccionado e unidades:** definir a precisão e a unidade antes de converter tipos; não arredondar dados existentes. Não confundir preço de venda com custo.
- **Notas, categorias, especialidade e contactos do salão:** colunas mínimas nas tabelas existentes, com validação e políticas adequadas. Não são necessárias para os fluxos já ligados.

## Ordem e condições de execução

1. Aprovar o âmbito exacto (as extensões opcionais não são implícitas).
2. Preparar staging com dados controlados; preservar definições actuais e plano de reversão.
3. Apresentar e rever o SQL exacto das alterações antes de aplicar qualquer migração.
4. Testar autorização, persistência, reservas concorrentes, pagamentos, recibos e regressões.
5. Executar alterações de produção apenas após aprovação da migração validada. Commits, merges e deploy continuam sujeitos às autorizações próprias.
