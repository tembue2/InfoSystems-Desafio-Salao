import { requireAccess, type ManagementClient } from '../access';
import { customerRecord } from '../adapters';
import { execute, ManagementError } from '../errors';
import { text, uuid } from '../validation';

export type CustomerInput = { name: string; phone?: string; email?: string };
function payload(input: CustomerInput) {
  const email = text(input.email ?? '', 'o email', 254, false);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ManagementError('validation', 'Email inválido.');
  return { full_name: text(input.name, 'o nome', 120), phone: text(input.phone ?? '', 'o telefone', 40, false) || null, email: email || null };
}
export function customers(client: ManagementClient) {
  return {
    async list(search = '', offset = 0) {
      await requireAccess(client);
      if (!Number.isInteger(offset) || offset < 0) throw new ManagementError('validation', 'Página inválida.');
      let query = client.from('clients').select('*').order('full_name').order('id').range(offset, offset + 49);
      const term = text(search, 'a pesquisa', 120, false).replace(/[\\%_]/g, '\\$&');
      if (term) query = query.ilike('full_name', `%${term}%`);
      return (await execute(() => query)).map(customerRecord);
    },
    async create(input: CustomerInput) {
      await requireAccess(client);
      return customerRecord(await execute(() => client.from('clients').insert(payload(input)).select().single()));
    },
    async update(id: string, input: CustomerInput) {
      await requireAccess(client);
      return customerRecord(await execute(() => client.from('clients').update(payload(input)).eq('id', uuid(id)).select().single()));
    },
  };
}
