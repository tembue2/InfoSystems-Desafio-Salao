import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types';
import type { Role } from './model';
import { ManagementError, managementError } from './errors';

export type ManagementClient = SupabaseClient<Database>;
export type ManagementAccess = { id: string; role: Role; name: string };
export const isManagementRole = (role: unknown): role is Role => role === 'manager' || role === 'reception';

export async function requireAccess(client: ManagementClient, roles: readonly Role[] = ['manager', 'reception']): Promise<ManagementAccess> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 400 || error.status === 401 || error.name === 'AuthSessionMissingError') {
      throw new ManagementError('unauthenticated', 'Inicie sessão para aceder à gestão.');
    }
    throw managementError(error);
  }
  if (!user) throw new ManagementError('unauthenticated', 'Inicie sessão para aceder à gestão.');
  const result = await client.from('profiles').select('id,role,full_name').eq('id', user.id).maybeSingle();
  if (result.error) throw managementError(result.error);
  if (!result.data || !isManagementRole(result.data.role) || !roles.includes(result.data.role)) {
    throw new ManagementError('forbidden', 'Esta conta não tem acesso a esta área de gestão.');
  }
  return { id: user.id, role: result.data.role, name: result.data.full_name };
}
