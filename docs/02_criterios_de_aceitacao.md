# 2. Critérios de aceitação e testes planeados

Estes são critérios de teste do MVP derivados das respostas e da proposta da Fase 1. **Não foram ainda executados num Supabase de testes**.

## Marcações

1. Cliente autenticada vê apenas serviços activos e profissionais que os realizam.
2. Uma reserva criada para horário vago fica `pending_payment`, com preço do catálogo copiado e validade de 60 minutos.
3. Um horário já reservado para o mesmo profissional não permite outra reserva com intersecção.
4. Dois pedidos concorrentes para o mesmo horário: um vence, o outro recebe erro de conflito.
5. Não aparecem horários fora das 08h–17h, domingo, no passado ou além dos 60 dias futuros.
6. Uma pré-reserva expirada não impede novo pedido para o mesmo intervalo.
7. A cliente não pode ver ou cancelar reservas de outras clientes.
8. Alterações à duração estimada e reagendamento devem, na etapa seguinte, preservar as regras de conflito.

## Pagamentos / cancelamentos

9. Apenas gerente ou recepção pode confirmar pagamento integral; cliente e profissional não podem.
10. Ao confirmar, cria-se exactamente um registo financeiro com valor igual ao da marcação e altera-se o estado para `confirmed` na mesma transacção.
11. Não é possível confirmar marcação expirada, cancelada ou já paga.
12. Cliente pode cancelar antecipadamente se faltarem mais de 24 horas; para menos tempo tem de contactar a equipa.
13. Cancelamento elegível de reserva paga assinala reembolso devido, sem afirmar que o dinheiro foi devolvido.
14. O registo de devolução efectiva, política para atrasos e não comparência, e recibo não fiscal ficam para a próxima etapa.

## Segurança e integridade

15. Conta cliente não pode elevar a própria função para `manager`.
16. Cliente não pode inserir directamente pagamentos ou alterar reservas por UPDATE/INSERT directo.
17. Ajuste de stock não pode originar quantidade negativa.
18. Testar cada rota e operação com gerente, recepção, profissional e cliente.
19. Dados e credenciais reais não entram nos dados de demonstração.

## Financeiro e inventário (etapa posterior)

20. Receitas por período têm de coincidir com pagamentos recebidos não devolvidos.
21. Saldos de caixa não podem contar reservas pendentes como receita.
22. Saídas de stock de vendas/consumo exigem rasto de movimentos e não permitem negativos.
23. Recibo interno deve indicar claramente a finalidade demonstrativa e não ser tratado como factura fiscal.

## Entrega do desafio

24. Link publicado, contas de demonstração, histórico Git, README, documento técnico até três páginas e manual para o salão (1–2 páginas ou vídeo).
25. Ensaiar demonstração de 15 min, uso real de 15 min e explicação/alteração técnica de 15 min.
