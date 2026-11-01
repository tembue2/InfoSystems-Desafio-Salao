import type { Database } from '../supabase/database.types';
import { ManagementError } from './errors';
import type { Status } from './model';

type Tables = Database['public']['Tables'];
export type Row<T extends keyof Tables> = Tables[T]['Row'];
export type BookingStatus = Database['public']['Enums']['booking_status'];
export type PaymentMethod = Exclude<Database['public']['Enums']['payment_method'], 'pos'>;

// Records are deliberately separate from demo models: unsupported fields are not invented.
export const customerRecord = (row: Row<'clients'>) => ({ id: row.id, name: row.full_name, phone: row.phone, email: row.email, profileId: row.profile_id });
export const serviceRecord = (row: Row<'services'>) => ({ id: row.id, name: row.name, description: row.description, price: row.price_mzn, minutes: row.duration_minutes, active: row.active });
export const professionalRecord = (row: Row<'professionals'>) => ({ id: row.id, name: row.display_name, profileId: row.profile_id, active: row.active });
export const bookingRecord = (row: Row<'bookings'>) => ({ id: row.id, customerId: row.client_id, profileId: row.customer_id, professionalId: row.professional_id, serviceId: row.service_id, startsAt: row.starts_at, endsAt: row.ends_at, price: row.price_mzn, status: row.status, expiresAt: row.expires_at });
export const productRecord = (row: Row<'products'>) => ({ id: row.id, name: row.name, kind: row.kind, salePrice: row.sale_price_mzn, quantity: row.quantity, minimum: row.min_quantity, active: row.active });

export function bookingStatusToDatabase(status: Status): BookingStatus {
  if (status === 'no_show') throw new ManagementError('unsupported', 'O backend ainda não suporta o estado Não compareceu.');
  return status === 'pending' ? 'pending_payment' : status;
}
export const bookingStatusLabel: Record<BookingStatus, string> = { pending_payment: 'Aguarda pagamento', confirmed: 'Confirmada', in_progress: 'Em atendimento', completed: 'Concluída', cancelled: 'Cancelada', expired: 'Expirada' };

export function paymentMethodToDatabase(method: string): PaymentMethod {
  const mapping: Record<string, PaymentMethod> = { 'M-Pesa': 'mpesa', 'e-Mola': 'emola', 'Numerário': 'cash', 'Transferência': 'bank_transfer' };
  const value = mapping[method];
  if (!value) throw new ManagementError('unsupported', 'Este método de pagamento não está disponível.');
  return value;
}

export function maputoDateTime(date: string, time: string) {
  const value = `${date}T${time}:00+02:00`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isFinite(Date.parse(value)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new ManagementError('validation', 'Data ou hora inválida.');
  return new Date(value).toISOString();
}
