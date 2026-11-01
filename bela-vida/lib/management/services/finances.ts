import { requireAccess, type ManagementClient } from '../access';
import { execute, ManagementError } from '../errors';
import { amount, instant, period, text } from '../validation';

export type FinanceSummary = { receipts: number; refunds: number; other: number; expenses: number; balance: number };
export function finances(client: ManagementClient) {
  return {
    async summary(from: string, to: string): Promise<FinanceSummary> {
      await requireAccess(client, ['manager']);
      const { start, end } = period(from, to);
      const data = await execute(() => client.rpc('finance_summary', { p_from: start, p_to: end }));
      if (typeof data !== 'object' || Array.isArray(data)) throw new ManagementError('unknown', 'Resumo financeiro inválido.');
      const values = ['receipts', 'refunds', 'other', 'expenses'].map(key => data[key]);
      if (!values.every(v => typeof v === 'number' && Number.isFinite(v))) throw new ManagementError('unknown', 'Resumo financeiro incompleto.');
      const [receipts, refunds, other, expenses] = values as number[];
      return { receipts, refunds, other, expenses, balance: receipts + other - refunds - expenses };
    },
    async addExpense(input: { description: string; amount: number; occurredAt: string }) {
      await requireAccess(client, ['manager']);
      // created_by is assigned by auth.uid() in the database, never supplied by the UI.
      return execute(() => client.from('expenses').insert({ description: text(input.description, 'a descrição', 500), amount_mzn: amount(input.amount), occurred_at: instant(input.occurredAt) }).select().single());
    },
  };
}
