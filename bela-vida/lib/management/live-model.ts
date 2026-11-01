import type { Data } from './model';
import type { Row } from './adapters';
export type LiveData = Data & {
  source: 'supabase'; loadedAt: string;
  otherIncome: { id: string; description: string; amount: number; date: string }[];
  operationalSettings: Pick<Row<'salon_settings'>, 'hold_minutes' | 'policy_text' | 'policy_approved'> | null;
  professionalAccounts: { id: string; name: string }[];
};
export type Command =
  | { type: 'customer.save'; id?: string; name: string; phone: string; email?: string }
  | { type: 'service.save'; id?: string; name: string; description?: string; price: number; minutes: number; active: boolean }
  | { type: 'professional.save'; id?: string; name: string; profileId: string | null; active: boolean }
  | { type: 'professional.associate'; professionalId: string; serviceId: string; enabled: boolean }
  | { type: 'professional.hours'; professionalId: string; weekday: number; open: boolean; opens: string; closes: string }
  | { type: 'booking.create'; serviceIds: string[]; professionalId: string; customerId: string; startsAt: string }
  | { type: 'booking.reschedule'; id: string; professionalId: string; startsAt: string }
  | { type: 'booking.cancel'; id: string }
  | { type: 'booking.status'; id: string; status: 'in_progress' | 'completed' }
  | { type: 'payment.register'; bookingId: string; amount: number; method: string; reference: string }
  | { type: 'payment.validate'; id: string; approve: boolean }
  | { type: 'payment.refund'; id: string; reason: string }
  | { type: 'expense.create'; description: string; amount: number; occurredAt: string }
  | { type: 'income.create'; description: string; amount: number; occurredAt: string }
  | { type: 'product.save'; id?: string; name: string; kind: 'sale' | 'consumable'; minimum: number; salePrice: number | null; active: boolean }
  | { type: 'stock.move'; productId: string; delta: number; reason: string }
  | { type: 'settings.save'; holdMinutes: number; policyText: string; policyApproved: boolean };
export type CommandRunner = (command: Command, message: string, closeDialog?: boolean) => Promise<boolean>;
