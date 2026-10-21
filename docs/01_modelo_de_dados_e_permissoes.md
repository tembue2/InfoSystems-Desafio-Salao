# 1. Modelo de dados e matriz de permissões

## Tabelas criadas

| Tabela | Finalidade | Dados principais |
|---|---|---|
| `profiles` | Utilizadores | Papel, nome, telefone, aniversário; ligação a `auth.users` |
| `professionals` | Profissionais | Ligação opcional ao utilizador, nome público e estado activo |
| `services` | Serviços | Nome, preço fixo, duração estimada, estado |
| `professional_services` | Oferta por profissional | Associação N:N entre profissional e serviço |
| `bookings` | Marcações | Cliente, profissional, serviço, intervalo, preço, estado, validade |
| `payments` | Recebimentos | Uma confirmação integral por marcação, método, responsável |
| `expenses` | Despesas | Descrição, montante, data, criador |
| `products` | Produtos/materiais | Tipo, quantidade e limiar mínimo |
| `stock_movements` | Histórico do inventário | Produto, variação, motivo e responsável |

Os valores monetários são `numeric(12,2)` em **MZN**. Preços são copiados para a reserva quando esta é criada, para preservar o valor histórico caso o catálogo mude.

## Permissões por perfil — desenho de MVP

| Funcionalidade | Gerente | Recepção | Profissional | Cliente |
|---|:---:|:---:|:---:|:---:|
| Consultar catálogo | ✓ | ✓ | ✓ | ✓ |
| Pedir reserva | ✓* | ✓* | ✓* | ✓ |
| Ver marcações de terceiros | ✓ | ✓ | Só as atribuídas | — |
| Validar pagamento integral | ✓ | ✓ | — | — |
| Ver pagamentos e despesas | ✓ | ✓ | — | — |
| Consultar stock | ✓ | ✓ | ✓ | — |
| Corrigir stock via função RPC | ✓ | ✓ | — | — |
| Alterar próprio nome/telemóvel | ✓ | ✓ | ✓ | ✓ |
| Alterar o próprio papel | — | — | — | — |

\* A função `create_booking` cria sempre uma reserva para o utilizador autenticado. Marcação presencial por conta de terceiros está **por desenvolver**.

\*\* O perfil profissional só pode consultar reservas atribuídas a si; nesta versão não consegue consultar os dados pessoais completos da cliente. A visualização de contactos por necessidade operacional será definida separadamente.

A matriz é o desenho pretendido e indica limitações efectivas; funcionalidades administrativas do catálogo/inventário e relatórios completos ainda não têm ecrã próprio. A promoção de funcionários é feita apenas pelo SQL Editor durante o ensaio.

## Relacionamentos críticos

- `auth.users` 1:1 `profiles`.
- `profiles` 1:N `bookings` como cliente.
- `professionals` N:N `services` através de `professional_services`.
- `bookings` 1:0..1 `payments` (um pagamento integral confirmado por marcação neste MVP).
- `products` 1:N `stock_movements`.

## Limites e evolução

Próxima etapa: modelos de vendas de produtos com linhas, devoluções e reconciliação; políticas mais finas por profissional; recibo simples não fiscal; auditoria de eventos financeiros e testes automatizados.
