import { requireAccess, type ManagementClient } from '../access';
import { serviceRecord } from '../adapters';
import { execute, ManagementError } from '../errors';
import { amount, text, uuid } from '../validation';

export type ServiceInput = { name: string; description?: string; price: number; minutes: number; active: boolean };
function payload(input: ServiceInput) {
  if (!Number.isInteger(input.minutes) || input.minutes < 15 || input.minutes > 480) throw new ManagementError('validation', 'A duração deve estar entre 15 e 480 minutos.');
  return { name: text(input.name, 'o nome', 120), description: text(input.description ?? '', 'a descrição', 1000, false) || null, price_mzn: amount(input.price, 0), duration_minutes: input.minutes, active: input.active };
}
export function catalog(client: ManagementClient) {
  return {
    async list() {
      await requireAccess(client);
      return (await execute(() => client.from('services').select('*').order('name').order('id'))).map(serviceRecord);
    },
    async save(input: ServiceInput, id?: string) {
      await requireAccess(client, ['manager']);
      const query = id ? client.from('services').update(payload(input)).eq('id', uuid(id)) : client.from('services').insert(payload(input));
      return serviceRecord(await execute(() => query.select().single()));
    },
  };
}
