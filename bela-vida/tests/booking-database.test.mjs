import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL engine in WASM, isolated in memory. Auth is a minimal SQL
// fixture, not a substitute for GoTrue/PostgREST or concurrent-session tests.
let db, day, manager, reception, customer, otherCustomer, clientId, pro, pro2, s1, s2, legacy;
const file = name => readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const one = async (sql, args=[]) => (await db.query(sql,args)).rows[0];
async function asUser(id, work) {
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);
 await db.exec('set role authenticated');
 try { return await work(); } finally { await db.exec('reset role'); }
}
const create = (services, start, professional=pro) => one('select public.request_booking_services($1::uuid[],$2,$3,$4) id',[services,professional,`${day}T${start}:00+02:00`,clientId]);
const move = (id, start, professional=pro) => one('select public.reschedule_booking($1,$2,$3)',[id,professional,`${day}T${start}:00+02:00`]);
const slots = (id, professional=pro) => db.query('select * from public.available_reschedule_slots($1,$2,$3)',[id,professional,day]);
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 alter default privileges in schema public grant select on tables to authenticated;
 create table auth.users(id uuid primary key default gen_random_uuid(),raw_user_meta_data jsonb default '{}'::jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec(file('20261101142033_mirror_infosystems_for_local_tests.sql').replace('create extension if not exists pgcrypto;',''));
 // Fixture users create customer profiles/clients through the existing triggers.
 const ids=[]; for(let i=0;i<4;i++) ids.push((await one('insert into auth.users default values returning id')).id);
 [manager,reception,customer,otherCustomer]=ids;
 await db.query("update public.profiles set role='manager' where id=$1",[manager]);
 await db.query("update public.profiles set role='reception' where id=$1",[reception]);
 clientId=(await one('select id from public.clients where profile_id=$1',[customer])).id;
 pro=(await one("insert into public.professionals(display_name) values('QA one') returning id")).id;
 pro2=(await one("insert into public.professionals(display_name) values('QA two') returning id")).id;
 s1=(await one("insert into public.services(name,price_mzn,duration_minutes) values('QA A',100,30) returning id")).id;
 s2=(await one("insert into public.services(name,price_mzn,duration_minutes) values('QA B',200,60) returning id")).id;
 for(const p of [pro,pro2]) {
  await db.query('insert into public.professional_services values($1,$2),($1,$3)',[p,s1,s2]);
  await db.query("insert into public.work_hours(professional_id,weekday,opens,closes) select $1,d,'08:00','17:00' from generate_series(1,7)d",[p]);
 }
 day=(await one("select ((now() at time zone 'Africa/Maputo')::date+2)::text as date_key")).date_key;
 legacy=(await asUser(reception,()=>one('select public.request_booking($1,$2,$3,$4) id',[s1,pro,`${day}T08:00:00+02:00`,clientId]))).id;
 await db.exec(file('20261101142316_multiservice_and_reschedule.sql'));
});
after(async()=>{await db?.close()});

test('SQL backfill and legacy single-service API preserve historical contract',async()=>{
 const i=await one('select * from public.booking_items where booking_id=$1',[legacy]);
 assert.equal(i.price_mzn,'100.00');assert.equal(i.duration_minutes,30);
 const b=await asUser(reception,()=>one('select public.request_booking($1,$2,$3,$4) id',[s1,pro,`${day}T08:30:00+02:00`,clientId]));
 assert.equal((await one('select count(*)::int n from public.booking_items where booking_id=$1',[b.id])).n,1);
});
test('SQL creates one booking with ordered historical items, total and contiguous duration',async()=>{
 const b=await asUser(reception,()=>create([s2,s1],'10:00'));
 const row=await one('select * from public.bookings where id=$1',[b.id]);
 assert.equal(row.service_id,s2);assert.equal(row.price_mzn,'300.00');assert.equal(+new Date(row.ends_at)-+new Date(row.starts_at),90*60000);
 const items=(await db.query('select * from public.booking_items where booking_id=$1 order by position',[b.id])).rows;
 assert.deepEqual(items.map(i=>i.service_id),[s2,s1]);assert.deepEqual(items.map(i=>i.service_name),['QA B','QA A']);
 await db.query("update public.services set price_mzn=900,name='QA A changed',duration_minutes=45 where id=$1",[s1]);
 const snapshot=await one('select * from public.booking_items where booking_id=$1 and service_id=$2',[b.id,s1]);assert.equal(snapshot.price_mzn,'100.00');assert.equal(snapshot.duration_minutes,30);assert.equal(snapshot.service_name,'QA A');
 // Restore catalogue so other tests have stable duration expectations.
 await db.query("update public.services set price_mzn=100,name='QA A',duration_minutes=30 where id=$1",[s1]);
});
test('SQL validates the entire bundle, rejects duplicate/empty/unknown/null services atomically',async()=>{
 const count=(await one('select count(*)::int n from public.bookings')).n;
 for(const services of [[],[s1,s1],[s1,null],[s1,'00000000-0000-0000-0000-000000000000']]) await assert.rejects(asUser(reception,()=>create(services,'12:00')));
 assert.equal((await one('select count(*)::int n from public.bookings')).n,count);
 await db.query('delete from public.professional_services where professional_id=$1 and service_id=$2',[pro2,s2]);
 await assert.rejects(asUser(reception,()=>create([s1,s2],'12:00',pro2)));
 await db.query('insert into public.professional_services values($1,$2)',[pro2,s2]);
});
test('SQL checks full duration, absences, boundaries and existing bookings',async()=>{
 await assert.rejects(asUser(reception,()=>create([s1,s2],'16:00')));
 await assert.rejects(asUser(reception,()=>create([s1,s2],'09:30'))); // overlaps the 10:00 bundle
 await db.query("insert into public.time_off(professional_id,starts_at,ends_at,reason) values($1,$2,$3,'QA absence')",[pro,`${day}T12:00:00+02:00`,`${day}T13:00:00+02:00`]);
 await assert.rejects(asUser(reception,()=>create([s1,s2],'11:30')));
 await asUser(reception,()=>create([s1],'11:30')); // exact adjacency is allowed
});
test('SQL paid rescheduling preserves ID, totals, items, expiration, payment and audit',async()=>{
 const {id}=await asUser(reception,()=>create([s1,s2],'13:00'));
 const payment=await asUser(reception,()=>one("select public.register_payment($1,300,'cash','QA') id",[id]));
 await asUser(reception,()=>one('select public.validate_payment($1,true)',[payment.id]));
 const before=await one('select * from public.bookings where id=$1',[id]);
 const paymentsBefore=(await db.query('select * from public.payments where booking_id=$1',[id])).rows;
 const itemsBefore=(await db.query('select * from public.booking_items where booking_id=$1 order by position',[id])).rows;
 const available=await asUser(reception,()=>slots(id));assert.ok(available.rows.some(s=>+new Date(s.slot_start)===+new Date(before.starts_at)));
 await asUser(manager,()=>move(id,'14:00',pro2));
 const after=await one('select * from public.bookings where id=$1',[id]);
 for(const key of ['id','price_mzn','status','expires_at','client_id','customer_id','created_at']) assert.deepEqual(after[key],before[key]);
 assert.equal(after.professional_id,pro2);assert.equal(+new Date(after.ends_at)-+new Date(after.starts_at),90*60000);
 assert.deepEqual((await db.query('select * from public.payments where booking_id=$1',[id])).rows,paymentsBefore);
 assert.deepEqual((await db.query('select * from public.booking_items where booking_id=$1 order by position',[id])).rows,itemsBefore);
 assert.ok((await one("select count(*)::int n from public.audit_events where record_id=$1 and action='UPDATE'",[id])).n>0);
 const audit=(await one('select count(*)::int n from public.audit_events')).n;
 await asUser(reception,()=>move(id,'14:00',pro2)); // idempotent no-op
 assert.equal((await one('select count(*)::int n from public.audit_events')).n,audit);
});
test('SQL conflicting reschedule rolls back; pending expiry is preserved and invalid states fail',async()=>{
 const before=await one('select * from public.bookings where id=$1',[legacy]);
 await assert.rejects(asUser(reception,()=>move(legacy,'10:30')));
 assert.deepEqual(await one('select * from public.bookings where id=$1',[legacy]),before);
 await asUser(reception,()=>move(legacy,'15:00'));
 const after=await one('select * from public.bookings where id=$1',[legacy]);assert.deepEqual(after.expires_at,before.expires_at);assert.equal(after.status,'pending_payment');
 for(const state of ['cancelled','expired','completed','in_progress']) {
  await db.query('update public.bookings set status=$1 where id=$2',[state,legacy]);
  await assert.rejects(asUser(reception,()=>move(legacy,'15:30')));
 }
 await db.query("update public.bookings set status='pending_payment',expires_at=now()-interval '1 minute' where id=$1",[legacy]);
 await assert.rejects(asUser(reception,()=>move(legacy,'15:30')));
});
test('SQL RLS follows parent visibility and prevents all direct item mutations',async()=>{
 const visible=await asUser(customer,()=>one('select count(*)::int n from public.booking_items'));assert.ok(visible.n>0);
 const hidden=await asUser(otherCustomer,()=>one('select count(*)::int n from public.booking_items'));assert.equal(hidden.n,0);
 await assert.rejects(asUser(reception,()=>db.exec('delete from public.booking_items')));
 await assert.rejects(asUser(manager,()=>db.exec('update public.booking_items set price_mzn=0')));
 await assert.rejects(asUser(customer,()=>move(legacy,'16:00')));
 await assert.rejects(asUser(otherCustomer,()=>create([s1],'16:00')));
 await assert.rejects(asUser(null,()=>slots(legacy)));
 await db.exec('set role anon');try { await assert.rejects(db.query('select * from public.booking_items')); await assert.rejects(db.query('select * from public.available_booking_slots($1,$2,$3)',[[s1],pro,day])); }finally{await db.exec('reset role')}
});

test('SQL security configuration exposes only authenticated entry points', async()=>{
 for(const name of ['available_booking_slots','request_booking_services','available_reschedule_slots','reschedule_booking']) {
  const row=await one("select p.prosecdef, p.proconfig, has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=$1",[name]);
  assert.equal(row.prosecdef,true);assert.equal(row.anon_execute,false);assert.ok(row.proconfig.some(s=>s.startsWith('search_path=')));
 }
 await assert.rejects(asUser(reception,()=>db.query('select * from management_private.slots($1,$2,30)',[pro,day])));
});
test('SQL feature rollback keeps bundles and payments, and restores safe legacy single creation',async()=>{
 const before=(await db.query('select * from public.booking_items order by booking_id,position')).rows;
 const paymentBefore=(await db.query('select * from public.payments order by id')).rows;
 await db.exec(readFileSync(new URL('../supabase/rollback/multiservice_and_reschedule.sql',import.meta.url),'utf8'));
 assert.deepEqual((await db.query('select * from public.booking_items order by booking_id,position')).rows,before);
 assert.deepEqual((await db.query('select * from public.payments order by id')).rows,paymentBefore);
 await assert.rejects(asUser(reception,()=>create([s1,s2],'16:00',pro2)));
 await assert.rejects(asUser(reception,()=>move(legacy,'16:00',pro2)));
 const created=await asUser(reception,()=>one('select public.request_booking($1,$2,$3,$4) id',[s1,pro2,`${day}T16:30:00+02:00`,clientId]));
 assert.equal((await one('select count(*)::int n from public.booking_items where booking_id=$1',[created.id])).n,1);
});
