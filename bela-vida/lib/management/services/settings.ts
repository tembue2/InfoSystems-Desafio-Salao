import { requireAccess, type ManagementClient } from '../access';
import { execute } from '../errors';

export function settings(client: ManagementClient) {
  return {
    async operational() {
      await requireAccess(client, ['manager']);
      return execute(() => client.from('salon_settings').select('hold_minutes,policy_text,policy_approved').eq('id', true).single());
    },
  };
}
