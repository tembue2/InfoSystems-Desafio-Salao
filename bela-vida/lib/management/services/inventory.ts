import { requireAccess, type ManagementClient } from '../access';
import { productRecord } from '../adapters';
import { execute, ManagementError } from '../errors';
import { text, uuid } from '../validation';

export function inventory(client: ManagementClient) {
  return {
    async list() {
      await requireAccess(client, ['manager']);
      return (await execute(() => client.from('products').select('*').order('name').order('id'))).map(productRecord);
    },
    async movements(productId: string, offset = 0) {
      await requireAccess(client, ['manager']);
      if (!Number.isInteger(offset) || offset < 0) throw new ManagementError('validation', 'Página inválida.');
      return execute(() => client.from('stock_movements').select('*').eq('product_id', uuid(productId)).order('created_at', { ascending: false }).order('id').range(offset, offset + 99));
    },
    async move(productId: string, delta: number, reason: string) {
      await requireAccess(client, ['manager']);
      if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 2147483647) throw new ManagementError('validation', 'Indique uma variação inteira de stock, diferente de zero.');
      return execute(() => client.rpc('adjust_stock', { p_product: uuid(productId), p_delta: delta, p_reason: text(reason, 'o motivo', 500) }));
    },
  };
}
