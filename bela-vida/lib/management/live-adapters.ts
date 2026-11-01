import type { WorkspaceRows } from './services/workspace';
import type { LiveData } from './live-model';
import type { Status, WorkDay } from './model';
import { ManagementError } from './errors';
export const maputoDay = (value: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Maputo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
export const maputoTime = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Maputo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
export function toLiveData(rows: WorkspaceRows, now = new Date()): LiveData {
  const services = new Map(rows.services.map(s => [s.id, s]));
  const customers = rows.clients.map(c => ({ id: c.id, name: c.full_name, phone: c.phone ?? '', email: c.email ?? '', notes: '' }));
  const clientByProfile = new Map(rows.clients.filter(c => c.profile_id).map(c => [c.profile_id!, c.id]));
  const clientIds = new Set(customers.map(c => c.id)); const professionalIds = new Set(rows.professionals.map(p => p.id));
  const itemsByBooking = new Map<string, WorkspaceRows['items']>();
  for (const item of rows.items) {
    const group = itemsByBooking.get(item.booking_id) ?? []; group.push(item); itemsByBooking.set(item.booking_id, group);
  }
  const appointments = rows.bookings.map(b => {
    const service = services.get(b.service_id); const customerId = b.client_id ?? (b.customer_id ? clientByProfile.get(b.customer_id) : undefined);
    if (!service || !customerId || !clientIds.has(customerId) || !professionalIds.has(b.professional_id)) throw new ManagementError('unknown', 'Uma marcação tem relações em falta. Não foi possível apresentar a agenda com segurança.');
    const items = itemsByBooking.get(b.id)?.sort((a,b) => a.position-b.position).map(i => ({ serviceId: i.service_id, name: i.service_name, price: i.price_mzn, minutes: i.duration_minutes }));
    if (!items?.length || Math.abs(items.reduce((n,i) => n+i.price,0)-b.price_mzn)>0.005 || items.reduce((n,i) => n+i.minutes,0)!==(Date.parse(b.ends_at)-Date.parse(b.starts_at))/60000) throw new ManagementError('unknown', 'Os serviços da marcação não correspondem ao total contratado. Actualize a integração.');
    const expired = b.status === 'pending_payment' && new Date(b.expires_at) <= now;
    const status: Status = expired ? 'expired' : b.status === 'pending_payment' ? 'pending' : b.status;
    return { id: b.id, customerId, professionalId: b.professional_id, date: maputoDay(b.starts_at), time: maputoTime(b.starts_at), items, status, notes: '', expiresAt: b.expires_at };
  });
  const bookingIds = new Set(appointments.map(b => b.id));
  if (rows.payments.some(p => !bookingIds.has(p.booking_id))) throw new ManagementError('unknown', 'Existem pagamentos sem marcação acessível. Actualize a sessão.');
  const methods = { cash: 'Numerário', mpesa: 'M-Pesa', emola: 'e-Mola', bank_transfer: 'Transferência', pos: 'POS' } as const;
  const schedule = (professionalId: string): WorkDay[] => Array.from({ length: 7 }, (_, day) => {
    const row = rows.hours.find(h => h.professional_id === professionalId && h.weekday === (day === 0 ? 7 : day));
    return { day, open: !!row, start: row?.opens.slice(0,5) ?? '', end: row?.closes.slice(0,5) ?? '', breakStart: '', breakEnd: '' };
  });
  return {
    source: 'supabase', loadedAt: now.toISOString(), customers, appointments,
    services: rows.services.map(s => ({ id: s.id, name: s.name, description: s.description ?? '', category: '', price: s.price_mzn, minutes: s.duration_minutes, active: s.active })),
    professionals: rows.professionals.map(p => ({ id: p.id, name: p.display_name, profileId: p.profile_id, specialty: '', active: p.active, serviceIds: rows.associations.filter(a => a.professional_id === p.id).map(a => a.service_id), schedule: schedule(p.id) })),
    payments: rows.payments.map(p => ({ id: p.id, appointmentId: p.booking_id, amount: p.amount_mzn, method: methods[p.method], reference: p.reference ?? '', date: maputoDay(p.received_at), receivedAt: p.received_at, validationStatus: p.validation_status as 'pending' | 'validated' | 'rejected', refundedAt: p.refunded_at, validatedAt: p.validated_at })),
    expenses: rows.expenses.map(e => ({ id: e.id, description: e.description, category: '', amount: e.amount_mzn, date: maputoDay(e.occurred_at) })),
    otherIncome: rows.income.map(e => ({ id: e.id, description: e.description, amount: e.amount_mzn, date: maputoDay(e.occurred_at) })),
    products: rows.products.map(p => ({ id: p.id, name: p.name, category: p.kind === 'sale' ? 'Produto' : 'Material', unit: '', salePrice: p.sale_price_mzn, quantity: p.quantity, minimum: p.min_quantity, active: p.active })),
    stockMovements: rows.movements.map(m => ({ id: m.id, productId: m.product_id, kind: m.delta > 0 ? 'Entrada' : 'Consumo', quantity: Math.abs(m.delta), delta: m.delta, reason: m.reason, at: m.created_at })),
    settings: { name: 'Salão Bela Vida', phone: '', address: '', schedule: [] },
    operationalSettings: rows.policy, professionalAccounts: rows.accounts.map(a => ({ id: a.id, name: a.full_name })),
    audit: rows.audit.map(a => ({ id: String(a.id), text: `${a.entity} · ${a.action}`, at: a.created_at, actorId: a.actor_id })),
  };
}
