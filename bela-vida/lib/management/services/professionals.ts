import { requireAccess, type ManagementClient } from '../access';
import { professionalRecord } from '../adapters';
import { execute, executeVoid } from '../errors';
import { text, uuid } from '../validation';

export function professionals(client: ManagementClient) {
  return {
    async list() {
      await requireAccess(client);
      return (await execute(() => client.from('professionals').select('*').order('display_name').order('id'))).map(professionalRecord);
    },
    async associations(id: string) {
      await requireAccess(client);
      return execute(() => client.from('professional_services').select('service_id').eq('professional_id', uuid(id)));
    },
    async hours(id: string) {
      await requireAccess(client, ['manager']);
      return execute(() => client.from('work_hours').select('*').eq('professional_id', uuid(id)).order('weekday'));
    },
    async save(input: { name: string; profileId?: string | null; active: boolean }, id?: string) {
      await requireAccess(client, ['manager']);
      const value = { display_name: text(input.name, 'o nome', 120), profile_id: input.profileId ? uuid(input.profileId) : null, active: input.active };
      const query = id ? client.from('professionals').update(value).eq('id', uuid(id)) : client.from('professionals').insert(value);
      return professionalRecord(await execute(() => query.select().single()));
    },
    async associate(professionalId: string, serviceId: string, enabled: boolean) {
      await requireAccess(client, ['manager']);
      const value = { professional_id: uuid(professionalId), service_id: uuid(serviceId) };
      await executeVoid(() => enabled ? client.from('professional_services').upsert(value) : client.from('professional_services').delete().match(value));
    },
  };
}
