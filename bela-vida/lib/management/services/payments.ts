import { requireAccess, type ManagementClient } from '../access';
import { execute, executeVoid, ManagementError } from '../errors';
import { paymentMethodToDatabase } from '../adapters';
import { amount, text, uuid } from '../validation';

export function payments(client: ManagementClient) {
  return {
    async forBooking(id: string) {
      await requireAccess(client);
      return execute(() => client.from('payments').select('*').eq('booking_id', uuid(id)).order('received_at').order('id'));
    },
    async register(input: { bookingId: string; amount: number; method: string; reference?: string }) {
      await requireAccess(client);
      const method = paymentMethodToDatabase(input.method);
      const reference = text(input.reference ?? '', 'a referência', 200, method !== 'cash');
      // Registration never confirms a booking. Only validate_payment decides its state.
      return execute(() => client.rpc('register_payment', { p_booking: uuid(input.bookingId), p_amount: amount(input.amount), p_method: method, p_reference: reference || undefined }));
    },
    async validate(id: string, approve: boolean) {
      await requireAccess(client);
      if (typeof approve !== 'boolean') throw new ManagementError('validation', 'Decisão inválida.');
      await executeVoid(() => client.rpc('validate_payment', { p_payment: uuid(id), p_approve: approve }));
    },
  };
}
