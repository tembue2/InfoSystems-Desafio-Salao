import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertStaging, stagingAccounts } from './config.mjs';
import { requireAccess } from '../../lib/management/access.ts';
import { loadWorkspace } from '../../lib/management/services/workspace.ts';
import { perform } from '../../lib/management/services/operations.ts';
import { bookings } from '../../lib/management/services/bookings.ts';
import { finances } from '../../lib/management/services/finances.ts';
import { paid } from '../../lib/management/model.ts';

// This script performs real writes. It refuses the production project and only
// uses reserved .invalid test accounts. It retains its labelled records for QA.
const target = assertStaging(process.env), accounts = stagingAccounts();
const makeClient = () => createClient(target.url, target.key, { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
const sessions = [];
async function login(role) {
  const client = makeClient();
  const { error } = await client.auth.signInWithPassword({ email: accounts[`STAGING_${role}_EMAIL`], password: accounts[`STAGING_${role}_PASSWORD`] });
  if (error) throw new Error(`Não foi possível autenticar a conta de testes ${role}.`);
  sessions.push(client); return client;
}
const marker = `QA-${Date.now()}`;
const check = name => console.log('PASS',name);
try {
  const manager = await login('MANAGER'), reception = await login('RECEPTION'), customer = await login('CUSTOMER');
  assert.equal((await requireAccess(manager)).role,'manager'); assert.equal((await requireAccess(reception)).role,'reception');
  await assert.rejects(requireAccess(customer),e => e.code === 'forbidden'); check('Login e perfis');
  await perform(reception,{type:'customer.save',name:marker,phone:'',email:`${marker.toLowerCase()}@bela-vida.invalid`});
  let snapshot = await loadWorkspace(manager); const clientId = snapshot.customers.find(c => c.name === marker)?.id; assert.ok(clientId); check('Criar cliente e persistir');
  await perform(manager,{type:'service.save',name:marker,description:'Serviço fictício de testes',price:500,minutes:60,active:true});
  await perform(manager,{type:'service.save',name:marker+' B',description:'Segundo serviço fictício',price:200,minutes:30,active:true});
  await perform(manager,{type:'professional.save',name:marker,profileId:null,active:true});
  snapshot = await loadWorkspace(manager); const serviceId = snapshot.services.find(s => s.name === marker)?.id, professionalId = snapshot.professionals.find(p => p.name === marker)?.id; assert.ok(serviceId && professionalId);
  const secondServiceId=snapshot.services.find(s=>s.name===marker+' B')?.id;assert.ok(secondServiceId);
  await perform(manager,{type:'professional.associate',professionalId,serviceId,enabled:true});
  await perform(manager,{type:'professional.associate',professionalId,serviceId:secondServiceId,enabled:true});
  const day = new Date(Date.now()+2*86400000).toISOString().slice(0,10), weekday = new Date(day+'T12:00:00Z').getUTCDay() || 7;
  await perform(manager,{type:'professional.hours',professionalId,weekday,open:true,opens:'08:00',closes:'17:00'});
  const slots = await bookings(reception).available([serviceId,secondServiceId],professionalId,day); assert.ok(slots.length); check('Serviço, profissional e disponibilidade');
  const request = {type:'booking.create',serviceIds:[serviceId,secondServiceId],professionalId,customerId:clientId,startsAt:slots[0].slot_start};
  await perform(reception,request); await assert.rejects(perform(reception,request),e => e.code === 'conflict');
  snapshot = await loadWorkspace(reception); const booking = snapshot.appointments.find(b => b.customerId === clientId); assert.ok(booking); check('Marcação e prevenção de sobreposição no servidor');
  await perform(reception,{type:'payment.register',bookingId:booking.id,amount:700,method:'Numerário',reference:marker});
  snapshot = await loadWorkspace(reception); assert.equal(snapshot.appointments.find(b => b.id === booking.id).status,'pending'); assert.equal(paid(snapshot,booking.id),0);
  const payment = snapshot.payments.find(p => p.appointmentId === booking.id); assert.ok(payment);
  await perform(reception,{type:'payment.validate',id:payment.id,approve:true}); snapshot=await loadWorkspace(reception);
  assert.equal(snapshot.appointments.find(b => b.id === booking.id).status,'confirmed'); assert.equal(paid(snapshot,booking.id),700); assert.ok(snapshot.payments.find(p => p.id === payment.id).validatedAt); check('Pagamento, confirmação e dados do recibo');
  assert.equal(snapshot.appointments.find(b=>b.id===booking.id).items.length,2);
  const alternatives=await bookings(reception).available([serviceId,secondServiceId],professionalId,day,booking.id);
  const nextSlot=alternatives.find(s=>s.slot_start!==request.startsAt);assert.ok(nextSlot);
  await perform(reception,{type:'booking.reschedule',id:booking.id,professionalId,startsAt:nextSlot.slot_start});
  snapshot=await loadWorkspace(reception);assert.equal(snapshot.appointments.find(b=>b.id===booking.id).status,'confirmed');assert.equal(paid(snapshot,booking.id),700);check('Reagendamento pago com dois serviços e persistência');
  await perform(manager,{type:'product.save',name:marker,kind:'consumable',minimum:1,salePrice:null,active:true}); snapshot=await loadWorkspace(manager); const productId=snapshot.products.find(p => p.name===marker)?.id; assert.ok(productId);
  await perform(manager,{type:'stock.move',productId,delta:5,reason:marker}); await perform(manager,{type:'stock.move',productId,delta:-2,reason:marker});
  await assert.rejects(perform(manager,{type:'stock.move',productId,delta:-10,reason:marker})); await assert.rejects(perform(reception,{type:'stock.move',productId,delta:1,reason:marker}),e=>e.code==='forbidden');
  const direct = await reception.from('products').select('id').eq('id',productId); assert.ifError(direct.error); assert.equal(direct.data.length,0); check('Stock e restrição RLS da Recepção');
  const occurredAt = new Date().toISOString(), from = occurredAt.slice(0,10)+'T00:00:00Z', to = occurredAt.slice(0,10)+'T23:59:59Z';
  const before = await finances(manager).summary(from,to);
  await perform(manager,{type:'expense.create',description:marker,amount:100,occurredAt}); await perform(manager,{type:'income.create',description:marker,amount:200,occurredAt});
  const after = await finances(manager).summary(from,to); assert.equal(Math.round((after.balance-before.balance)*100),10000); check('Finanças, despesas e outras receitas');
  await perform(reception,{type:'booking.cancel',id:booking.id}); await perform(manager,{type:'payment.refund',id:payment.id,reason:marker+' — reembolso fictício em staging'});
  snapshot=await loadWorkspace(manager); assert.equal(snapshot.appointments.find(b=>b.id===booking.id).status,'cancelled'); assert.ok(snapshot.payments.find(p=>p.id===payment.id).refundedAt); assert.equal(snapshot.products.find(p=>p.id===productId).quantity,3); check('Cancelamento, reembolso e nova leitura persistida');
  console.log('Cenários concluídos no projecto de testes. Registos identificados por',marker);
} catch(error) { console.error('FAIL', error.message); process.exitCode=1; }
finally { await Promise.allSettled(sessions.map(c => c.auth.signOut({scope:'local'}))); }
