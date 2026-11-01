import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { requireAccess } from '../lib/management/access.ts';
import { bookingStatusToDatabase, paymentMethodToDatabase, maputoDateTime } from '../lib/management/adapters.ts';
import { managementError } from '../lib/management/errors.ts';
import { customers } from '../lib/management/services/customers.ts';
import { bookings } from '../lib/management/services/bookings.ts';
import { inventory } from '../lib/management/services/inventory.ts';
import { payments } from '../lib/management/services/payments.ts';
import { finances } from '../lib/management/services/finances.ts';
import { catalog } from '../lib/management/services/catalog.ts';
import { publicSupabaseConfig } from '../lib/supabase/config.ts';

const userId = '10000000-0000-4000-8000-000000000001';
const recordId = '20000000-0000-4000-8000-000000000002';
function fixture({ role = 'manager', authStatus = 200, handler = () => [] } = {}) {
  const requests = [];
  const client = createClient('https://controlled-test.supabase.co', 'sb_publishable_controlled_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: 'Bearer controlled-test-token' }, fetch: async (url, options) => {
      const path = new URL(url).pathname;
      requests.push({ path, options, url: String(url) });
      let value, status = 200;
      if (path === '/auth/v1/user') {
        status = authStatus;
        value = status === 200 ? { id: userId, aud: 'authenticated', role: 'authenticated', user_metadata: { role: 'manager' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' } : { message: 'Invalid token', code: 'bad_jwt' };
      } else if (path === '/rest/v1/profiles') {
        assert.equal(new URL(url).searchParams.get('id'), 'eq.' + userId);
        value = [{ id: userId, role, full_name: 'Equipa de teste' }];
      } else {
        value = await handler(path, options, String(url));
      }
      return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  return { client, requests };
}

test('access comes from profiles, never editable user metadata', async () => {
  const { client } = fixture({ role: 'customer' });
  await assert.rejects(requireAccess(client), e => e.code === 'forbidden');
});
test('reception can authenticate but cannot enter manager services', async () => {
  const { client, requests } = fixture({ role: 'reception' });
  assert.equal((await requireAccess(client)).role, 'reception');
  await assert.rejects(inventory(client).list(), e => e.code === 'forbidden');
  assert.equal(requests.some(r => r.path.endsWith('/products')), false);
});
test('invalid session stops queries before reading profiles or operational tables', async () => {
  const { client, requests } = fixture({ authStatus: 401 });
  await assert.rejects(customers(client).list(), e => e.code === 'unauthenticated');
  assert.equal(requests.length, 1);
});
test('customer updates send only allowed columns and retain the database identifier', async () => {
  const { client } = fixture({ handler(path, options) {
    assert.equal(path, '/rest/v1/clients');
    const body = JSON.parse(options.body);
    assert.deepEqual(body, { full_name: 'Ana', phone: null, email: 'ana@example.com' });
    return { id: recordId, ...body, profile_id: null };
  } });
  const row = await customers(client).update(recordId, { name: ' Ana ', email: 'ana@example.com', notes: 'Must not be sent' });
  assert.equal(row.id, recordId);
  assert.equal(row.email, 'ana@example.com');
});
test('service duration follows the real database limit', async () => {
  const { client, requests } = fixture();
  await assert.rejects(catalog(client).save({ name: 'Teste', price: 500, minutes: 540, active: true }), e => e.code === 'validation');
  assert.equal(requests.some(r => r.path.endsWith('/services')), false);
});
test('a multi-service selection uses one atomic booking RPC', async () => {
  const { client, requests } = fixture({ handler(path, options) {
    assert.equal(path, '/rest/v1/rpc/request_booking_services');
    assert.deepEqual(JSON.parse(options.body).p_services, [recordId, userId]); return recordId;
  } });
  assert.equal(await bookings(client).create({ serviceIds: [recordId, userId], professionalId: userId, customerId: userId, startsAt: '2026-11-02T08:00:00+02:00' }), recordId);
  assert.equal(requests.filter(r => r.path.includes('/rpc/')).length, 1);
});
test('rescheduling uses the existing booking ID and no payment or cancellation RPC', async () => {
  const { client, requests } = fixture({ handler(path, options) {
    assert.equal(path, '/rest/v1/rpc/reschedule_booking');
    assert.deepEqual(JSON.parse(options.body), {p_booking:recordId,p_professional:userId,p_starts_at:'2026-11-02T06:00:00.000Z'}); return null;
  } });
  await bookings(client).reschedule(recordId,userId,'2026-11-02T08:00:00+02:00');
  assert.equal(requests.filter(r => r.path.includes('/rpc/')).length,1);
});
test('invalid service selections fail before any RPC', async () => {
  const {client,requests}=fixture();
  for(const serviceIds of [[],[recordId,recordId],['invalid']]) await assert.rejects(bookings(client).create({serviceIds,professionalId:userId,customerId:userId,startsAt:'2026-11-02T08:00:00+02:00'}),e=>e.code==='validation');
  assert.equal(requests.some(r=>r.path.includes('/rpc/')),false);
});
test('staff booking uses request_booking and the selected client', async () => {
  const { client } = fixture({ role: 'reception', handler(path, options) {
    assert.equal(path, '/rest/v1/rpc/request_booking_services');
    assert.deepEqual(JSON.parse(options.body), { p_services: [recordId], p_professional: userId, p_client: userId, p_starts_at: '2026-11-02T06:00:00.000Z' });
    return recordId;
  } });
  assert.equal(await bookings(client).create({ serviceIds: [recordId], professionalId: userId, customerId: userId, startsAt: '2026-11-02T08:00:00+02:00' }), recordId);
});
test('registration does not call validation or legacy confirmation', async () => {
  const { client, requests } = fixture({ handler(path) { assert.equal(path, '/rest/v1/rpc/register_payment'); return recordId; } });
  await payments(client).register({ bookingId: userId, amount: 500, method: 'M-Pesa', reference: 'TEST' });
  assert.equal(requests.filter(r => r.path.includes('/rpc/')).length, 1);
});
test('void RPC validation accepts a successful null response', async () => {
  const { client } = fixture({ handler(path) { assert.equal(path, '/rest/v1/rpc/validate_payment'); return null; } });
  await payments(client).validate(recordId, true);
});
test('fractional stock movement is rejected before RPC', async () => {
  const { client, requests } = fixture();
  await assert.rejects(inventory(client).move(recordId, 0.5, 'Teste'), e => e.code === 'validation');
  assert.equal(requests.some(r => r.path.includes('/rpc/')), false);
});
test('finance includes validated receipts, other income, refunds and expenses', async () => {
  const { client } = fixture({ handler: () => ({ receipts: 1000, refunds: 200, other: 300, expenses: 400 }) });
  assert.equal((await finances(client).summary('2026-11-01T00:00:00+02:00', '2026-12-01T00:00:00+02:00')).balance, 700);
});
test('unknown financial values are not displayed as zero', async () => {
  const { client } = fixture({ handler: () => ({ receipts: 1000 }) });
  await assert.rejects(finances(client).summary('2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z'), e => e.code === 'unknown');
});
test('unsupported states and methods do not get coerced into valid values', () => {
  assert.equal(bookingStatusToDatabase('pending'), 'pending_payment');
  assert.throws(() => bookingStatusToDatabase('no_show'), e => e.code === 'unsupported');
  assert.throws(() => paymentMethodToDatabase('POS'), e => e.code === 'unsupported');
  assert.equal(maputoDateTime('2026-11-02', '08:00'), '2026-11-02T06:00:00.000Z');
  assert.throws(() => maputoDateTime('2026-02-30', '08:00'));
});
test('network failures become a safe retryable error without provider details', async () => {
  const { client } = fixture({ handler() { throw new TypeError('fetch failed: internal details'); } });
  await assert.rejects(customers(client).list(), e => e.code === 'network' && !e.message.includes('internal'));
  assert.equal(managementError({ code: '42501', message: 'private detail' }).code, 'forbidden');
});
test('public config refuses a secret or service role key', () => {
  const previous = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://controlled-test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_secret_forbidden';
    assert.throws(publicSupabaseConfig);
  } finally {
    for (const [key, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: previous.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: previous.key })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('availability sends all services and rescheduling uses the historical booking contract', async () => {
 const {client,requests}=fixture({handler(path, options){
  const body=JSON.parse(options.body);
  if(path.endsWith('/available_booking_slots')) assert.deepEqual(body.p_services,[recordId,userId]);
  else { assert.ok(path.endsWith('/available_reschedule_slots'));assert.equal(body.p_booking,recordId);assert.equal('p_services' in body,false); }
  return [{slot_start:'2026-11-02T06:00:00Z'}];
 }});
 await bookings(client).available([recordId,userId],userId,'2026-11-02');
 await bookings(client).available([recordId,userId],userId,'2026-11-02',recordId);
 assert.equal(requests.filter(r=>r.path.includes('/rpc/')).length,2);
});
