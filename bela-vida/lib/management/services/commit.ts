import type { ManagementClient } from '../access';
import type { Command, LiveData } from '../live-model';
import { managementError } from '../errors';
import { perform } from './operations';
import { loadWorkspace } from './workspace';

export async function executeAndReload(client: ManagementClient, command: Command, reload: (client: ManagementClient) => Promise<LiveData> = loadWorkspace) {
  try { await perform(client, command); }
  catch (error) {
    const e = managementError(error);
    return { ok: false as const, error: e.message, code: e.code, uncertain: e.code === 'network' || e.code === 'unknown' };
  }
  try { return { ok: true as const, data: await reload(client), refreshError: null }; }
  catch { return { ok: true as const, data: null, refreshError: 'A operação foi guardada, mas não foi possível actualizar o ecrã. Actualize os dados antes de continuar.' }; }
}
