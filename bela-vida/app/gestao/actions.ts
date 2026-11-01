'use server';
import { createClient } from '@/lib/supabase/server';
import { requireAccess } from '@/lib/management/access';
import { loadWorkspace } from '@/lib/management/services/workspace';
import { executeAndReload } from '@/lib/management/services/commit';
import { bookings } from '@/lib/management/services/bookings';
import { managementError } from '@/lib/management/errors';
import type { Command } from '@/lib/management/live-model';

export async function refreshWorkspace() {
  try { return { ok: true as const, data: await loadWorkspace(await createClient()) }; }
  catch(error) { const e = managementError(error); return { ok: false as const, error: e.message, code: e.code }; }
}
export async function executeCommand(command: Command) {
  try { return await executeAndReload(await createClient(), command); }
  catch(error) { const e = managementError(error); return { ok: false as const, error: e.message, code: e.code, uncertain: false }; }
}
export async function availableSlots(serviceIds: string[], professionalId: string, date: string, bookingId?: string) {
  try {
    const client = await createClient(); await requireAccess(client);
    return { ok: true as const, slots: await bookings(client).available(serviceIds, professionalId, date, bookingId) };
  } catch(error) { const e = managementError(error); return { ok: false as const, error: e.message }; }
}
