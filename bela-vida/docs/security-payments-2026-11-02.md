# Segurança e pagamentos — 2 de Novembro de 2026

## Regra em vigor
A aprovação pela recepção ou gerente confirma a marcação sem exigir pagamento. Novas marcações internas também ficam confirmadas. O horário permanece ocupado até cancelamento/conclusão; o prazo antigo de pagamento não liberta uma marcação confirmada. Clientes enviam pedidos, não criam directamente marcações confirmadas.

O registo financeiro continua manual e integral: a RPC exige exactamente o saldo em falta, rejeita valores parciais/excessivos/com mais de duas casas decimais, exige referência nos métodos não numerários e serializa por marcação. Validar o recebimento não muda o estado do atendimento. É possível pagar uma marcação confirmada, em atendimento ou concluída. Cancelamentos e reembolsos mantêm as autorizações existentes.

Reservas antigas já expiradas não são reactivadas automaticamente: a disponibilidade precisa de nova confirmação pela gestão. Na publicação existiam cinco nesta situação.

## Dependências
- Next.js: 16.3.4 → 16.4.4 na aplicação publicada; manifesto legado da raiz também actualizado.
- Zod: 3.25.76 → 4.6.7.
- Novo package-lock.json na aplicação, além do lockfile da raiz.
- npm audit: zero vulnerabilidades reportadas em ambos os projectos após actualização. Isto não constitui garantia de ausência de todas as vulnerabilidades.

## Privilégios e verificação
64 testes passaram, incluindo PostgreSQL isolado (PGlite), serviços de integração e renderização. Build Next.js e TypeScript passaram.
Testes novos: confirmação sem pagamento; ocupação após prazo antigo; atendimento antes do pagamento; rejeição de pagamentos parciais, duplicados e referência ausente; decisões nulas; aprovação idempotente; negação de RPCs administrativas a clientes; isolamento de profissional por marcação; negação de pagamentos/reembolsos/stock a perfis sem autorização; bloqueio de escrita directa em pagamentos; lista explícita de funções públicas.

Uma transacção no Supabase de produção confirmou criação sem pagamento, recusa de parcial, registo integral e validação, com ROLLBACK de todos os dados de verificação. Não foi realizada cobrança real. Os testes isolados não simulam concorrência de múltiplas sessões nem substituem teste autenticado no navegador.

## Alertas remanescentes
O advisor sinaliza SECURITY DEFINER em funções públicas intencionais (catálogo, disponibilidade e submissão) e funções autenticadas com verificações de perfil. Não foram abertas novas permissões. A protecção contra palavras-passe comprometidas continua desactivada no Supabase Auth e requer configuração adicional. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
