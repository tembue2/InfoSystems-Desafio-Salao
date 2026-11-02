import type { ManagementClient } from '../access';
import { requireAccess } from '../access';
import { execute, ManagementError } from '../errors';
import type { Row } from '../adapters';
import type { LiveData } from '../live-model';
import { toLiveData } from '../live-adapters';
/** Never calculate totals from just the first API page. */
export async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; from < 20000; from += 200) {
    const rows = await execute(() => page(from, from + 199)); result.push(...rows);
    if (rows.length < 200) return result;
  }
  throw new ManagementError('unsupported', 'O volume de dados exige uma consulta por período. Nenhum total parcial foi apresentado.');
}
export async function loadWorkspace(client: ManagementClient): Promise<LiveData> {
  const access = await requireAccess(client); const manager = access.role === 'manager';
  const read = <T>(request: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) => allRows(request);
  const [clients, services, professionals, associations, bookings, payments, expenses, products, movements, hours, audit, income, policy, accounts, items] = await Promise.all([
    read((a,b) => client.from('clients').select('*').order('id').range(a,b)),
    read((a,b) => client.from('services').select('*').order('id').range(a,b)),
    read((a,b) => client.from('professionals').select('*').order('id').range(a,b)),
    read((a,b) => client.from('professional_services').select('*').order('professional_id').order('service_id').range(a,b)),
    read((a,b) => client.from('bookings').select('*').order('id').range(a,b)),
    read((a,b) => client.from('payments').select('*').order('id').range(a,b)),
    manager ? read((a,b) => client.from('expenses').select('*').order('id').range(a,b)) : [],
    manager ? read((a,b) => client.from('products').select('*').order('id').range(a,b)) : [],
    manager ? read((a,b) => client.from('stock_movements').select('*').order('id').range(a,b)) : [],
    manager ? read((a,b) => client.from('work_hours').select('*').order('id').range(a,b)) : [],
    manager ? execute(() => client.from('audit_events').select('*').order('id', { ascending: false }).limit(50)) : [],
    manager ? read((a,b) => client.from('manual_income').select('*').order('id').range(a,b)) : [],
    manager ? execute(() => client.from('salon_settings').select('*').eq('id', true).single()) : null,
    manager ? read((a,b) => client.from('profiles').select('id,full_name').eq('role', 'professional').order('id').range(a,b)) : [],
    read((a,b) => client.from('booking_items').select('*').order('booking_id').order('position').range(a,b)),
  ]);
  return toLiveData({ clients, services, professionals, associations, bookings, payments, expenses, products, movements, hours, audit, income, policy, accounts, items });
}
export type WorkspaceRows = {
  clients: Row<'clients'>[]; services: Row<'services'>[]; professionals: Row<'professionals'>[];
  items: Row<'booking_items'>[]; associations: Row<'professional_services'>[]; bookings: Row<'bookings'>[]; payments: Row<'payments'>[];
  expenses: Row<'expenses'>[]; products: Row<'products'>[]; movements: Row<'stock_movements'>[];
  hours: Row<'work_hours'>[]; audit: Row<'audit_events'>[]; income: Row<'manual_income'>[];
  policy: Row<'salon_settings'> | null; accounts: { id: string; full_name: string }[];
};
