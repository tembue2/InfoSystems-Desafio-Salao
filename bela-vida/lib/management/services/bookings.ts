import { requireAccess, type ManagementClient } from '../access';
import { bookingRecord } from '../adapters';
import { execute, executeVoid, ManagementError } from '../errors';
import { day, instant, period, uuid } from '../validation';

export function bookings(client: ManagementClient) {
  return {
    async list(from: string, to: string, offset = 0) {
      await requireAccess(client);
      const { start, end } = period(from, to);
      if (!Number.isInteger(offset) || offset < 0) throw new ManagementError('validation', 'Página inválida.');
      return (await execute(() => client.from('bookings').select('*').gte('starts_at', start).lt('starts_at', end).order('starts_at').order('id').range(offset, offset + 99))).map(bookingRecord);
    },
    async available(serviceIds: string[], professionalId: string, date: string, bookingId?: string) {
      await requireAccess(client);
      const common = { p_professional: uuid(professionalId), p_day: day(date) };
      if (bookingId) return execute(() => client.rpc('available_reschedule_slots', { ...common, p_booking: uuid(bookingId) }));
      return execute(() => client.rpc('available_booking_slots', { ...common, p_services: serviceList(serviceIds) }));
    },
    async create(input: { serviceIds: string[]; professionalId: string; startsAt: string; customerId: string }) {
      await requireAccess(client);
      return execute(() => client.rpc('request_booking_services', { p_services: serviceList(input.serviceIds), p_professional: uuid(input.professionalId), p_starts_at: instant(input.startsAt), p_client: uuid(input.customerId) }));
    },
    async reschedule(id: string, professionalId: string, startsAt: string) {
      await requireAccess(client);
      await executeVoid(() => client.rpc('reschedule_booking', { p_booking: uuid(id), p_professional: uuid(professionalId), p_starts_at: instant(startsAt) }));
    },
    async cancel(id: string) {
      await requireAccess(client);
      await executeVoid(() => client.rpc('cancel_booking', { p_booking: uuid(id) }));
    },
    async setStatus(id: string, status: 'in_progress' | 'completed') {
      await requireAccess(client);
      if (!['in_progress', 'completed'].includes(status)) throw new ManagementError('validation', 'Transição inválida.');
      await executeVoid(() => client.rpc('set_booking_status', { p_booking: uuid(id), p_status: status }));
    },
  };
}

function serviceList(ids: string[]) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20 || new Set(ids).size !== ids.length) throw new ManagementError('validation', 'Seleccione entre 1 e 20 serviços diferentes.');
  return ids.map(id => uuid(id));
}
