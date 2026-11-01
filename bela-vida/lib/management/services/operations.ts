import { requireAccess, type ManagementClient } from '../access';
import type { Command } from '../live-model';
import { customers } from './customers';
import { catalog } from './catalog';
import { professionals } from './professionals';
import { bookings } from './bookings';
import { payments } from './payments';
import { finances } from './finances';
import { inventory } from './inventory';
import { execute, executeVoid, ManagementError } from '../errors';
import { uuid, text, amount, instant } from '../validation';

const bad = (message: string): never => { throw new ManagementError('validation', message); };
const boolean = (value: boolean) => typeof value === 'boolean' ? value : bad('Valor inválido.');
const count = (value: number) => Number.isInteger(value) && value >= 0 && value <= 2147483647 ? value : bad('Indique uma quantidade inteira válida.');

export async function perform(client: ManagementClient, command: Command): Promise<void> {
  if (!command || typeof command !== 'object' || typeof command.type !== 'string') bad('Operação inválida.');
  // Authorisation is always derived from the session, never from the command.
  const access = await requireAccess(client);
  const manager = () => { if (access.role !== 'manager') throw new ManagementError('forbidden', 'Operação reservada ao Gerente.'); };
  switch (command.type) {
    case 'customer.save': {
      const input = { name: command.name, phone: command.phone, email: command.email };
      if (command.id) await customers(client).update(command.id, input); else await customers(client).create(input);
      return;
    }
    case 'service.save': manager(); boolean(command.active); await catalog(client).save(command, command.id); return;
    case 'professional.save': {
      manager(); boolean(command.active);
      if (command.id && !command.active) {
        const professionalId=uuid(command.id);
        const rows = await execute(() => client.from('bookings').select('id').eq('professional_id', professionalId).gt('ends_at', new Date().toISOString()).in('status', ['pending_payment','confirmed','in_progress']).limit(1));
        if (rows.length) throw new ManagementError('conflict', 'Existem marcações activas deste profissional. Resolva-as antes de o desactivar.');
      }
      await professionals(client).save(command, command.id); return;
    }
    case 'professional.associate': {
      manager(); boolean(command.enabled);
      if (!command.enabled) {
        const rows = await execute(() => client.from('bookings').select('id,booking_items!inner(service_id)').eq('professional_id', uuid(command.professionalId)).eq('booking_items.service_id', uuid(command.serviceId)).gt('ends_at', new Date().toISOString()).in('status', ['pending_payment','confirmed','in_progress']).limit(1));
        if (rows.length) throw new ManagementError('conflict', 'Existem marcações activas para este serviço. Resolva-as antes de retirar a associação.');
      }
      await professionals(client).associate(command.professionalId, command.serviceId, command.enabled); return;
    }
    case 'professional.hours': {
      manager(); const id = uuid(command.professionalId); boolean(command.open);
      if (!Number.isInteger(command.weekday) || command.weekday < 1 || command.weekday > 7) bad('Dia inválido.');
      if (command.open && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(command.opens) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(command.closes) || command.opens >= command.closes)) bad('Verifique o horário de entrada e saída.');
      // Conservative guard. Atomic protection against concurrent changes needs a backend RPC.
      const future = await execute(() => client.from('bookings').select('id').eq('professional_id', id).gte('starts_at', new Date().toISOString()).in('status', ['pending_payment','confirmed','in_progress']).limit(1));
      if (future.length) throw new ManagementError('conflict', 'Existem reservas futuras deste profissional. Resolva-as antes de alterar o horário.');
      if (command.open) await executeVoid(() => client.from('work_hours').upsert({ professional_id: id, weekday: command.weekday, opens: command.opens, closes: command.closes }, { onConflict: 'professional_id,weekday' }));
      else await executeVoid(() => client.from('work_hours').delete().eq('professional_id', id).eq('weekday', command.weekday));
      return;
    }
    case 'booking.create': await bookings(client).create(command); return;
    case 'booking.reschedule': await bookings(client).reschedule(command.id, command.professionalId, command.startsAt); return;
    case 'booking.cancel': await bookings(client).cancel(command.id); return;
    case 'booking.status': await bookings(client).setStatus(command.id, command.status); return;
    case 'payment.register': {
      const booking = await execute(() => client.from('bookings').select('price_mzn').eq('id', uuid(command.bookingId)).single());
      const previous = await payments(client).forBooking(command.bookingId);
      const outstanding = Math.round((booking.price_mzn - previous.filter(p => p.validation_status !== 'rejected' && !p.refunded_at).reduce((total,p) => total + p.amount_mzn,0)) * 100);
      if (Math.round(amount(command.amount) * 100) !== outstanding) bad('Registe o valor integral em falta. Actualize os dados antes de continuar.');
      await payments(client).register(command); return;
    }
    case 'payment.validate': await payments(client).validate(command.id, boolean(command.approve)); return;
    case 'payment.refund': manager(); await executeVoid(() => client.rpc('refund_payment', { p_payment: uuid(command.id), p_reason: text(command.reason, 'o motivo', 500) })); return;
    case 'expense.create': manager(); await finances(client).addExpense(command); return;
    case 'income.create': manager(); await execute(() => client.from('manual_income').insert({ description: text(command.description, 'a descrição', 500), amount_mzn: amount(command.amount), occurred_at: instant(command.occurredAt) }).select().single()); return;
    case 'product.save': {
      manager(); boolean(command.active);
      if (!['sale','consumable'].includes(command.kind)) bad('Tipo de artigo inválido.');
      const payload = { name: text(command.name, 'o nome', 120), kind: command.kind, min_quantity: count(command.minimum), sale_price_mzn: command.salePrice === null ? null : amount(command.salePrice, 0), active: command.active };
      // quantity is intentionally absent; every balance change goes through adjust_stock.
      const query = command.id ? client.from('products').update(payload).eq('id', uuid(command.id)) : client.from('products').insert(payload);
      await execute(() => query.select().single()); return;
    }
    case 'stock.move': manager(); await inventory(client).move(command.productId, command.delta, command.reason); return;
    case 'settings.save': {
      manager(); boolean(command.policyApproved);
      if (!Number.isInteger(command.holdMinutes) || command.holdMinutes < 5 || command.holdMinutes > 1440) bad('O prazo deve estar entre 5 e 1440 minutos.');
      await execute(() => client.from('salon_settings').update({ hold_minutes: command.holdMinutes, policy_text: text(command.policyText, 'a política', 10000), policy_approved: command.policyApproved }).eq('id', true).select().single()); return;
    }
    default: throw new ManagementError('unsupported', 'Esta operação ainda não está disponível.');
  }
}
