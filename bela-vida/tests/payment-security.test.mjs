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
 await db.exec(file('20261102080610_public_booking_requests.sql'));
 await db.exec(file('20261102175645_independent_booking_payments.sql'));
});
after(async()=>{await db?.close()});

test('booking is confirmed unpaid, keeps slot past expiry, and can complete before payment',async()=>{
 const b=await asUser(reception,()=>create([s1],'09:00'));
 assert.equal((await one('select status from public.bookings where id=$1',[b.id])).status,'confirmed');
 await db.query("update public.bookings set expires_at=now()-interval '1 day' where id=$1",[b.id]);
 await assert.rejects(asUser(manager,()=>create([s1],'09:00')));
 await asUser(reception,()=>move(b.id,'09:30'));
 for(const status of ['in_progress','completed'])await asUser(manager,()=>one('select public.set_booking_status($1,$2)',[b.id,status]));
 for(const amount of [0,-1,50,101,100.001])await assert.rejects(asUser(reception,()=>one("select public.register_payment($1,$2,'cash',null)",[b.id,amount])));
 await assert.rejects(asUser(reception,()=>one("select public.register_payment($1,100,'mpesa',null)",[b.id])));
 const p=await asUser(reception,()=>one("select public.register_payment($1,100,'cash',null) id",[b.id]));
 await assert.rejects(asUser(reception,()=>one("select public.register_payment($1,100,'cash',null)",[b.id])));
 await assert.rejects(asUser(reception,()=>one('select public.validate_payment($1,null)',[p.id])));
 await asUser(reception,()=>one('select public.validate_payment($1,true)',[p.id]));
 assert.equal((await one('select status from public.bookings where id=$1',[b.id])).status,'completed');
 await assert.rejects(asUser(reception,()=>one('select public.validate_payment($1,true)',[p.id])));
});
test('public request requires staff approval and approval does not invent a payment',async()=>{
 await db.exec('set role anon');let r;
 try{r=await one("select public.submit_booking_request(gen_random_uuid(),'QA request','841234567','',$1::uuid[],$2,$3) id",[[s1],pro,`${day}T12:00:00+02:00`]);}finally{await db.exec('reset role');}
 await assert.rejects(asUser(customer,()=>one('select public.review_booking_request($1,true)',[r.id])));
 await assert.rejects(asUser(manager,()=>one('select public.review_booking_request($1,null)',[r.id])));
 const b=await asUser(manager,()=>one('select public.review_booking_request($1,true) id',[r.id]));
 assert.equal((await one('select status from public.bookings where id=$1',[b.id])).status,'confirmed');
 assert.equal((await one('select count(*)::int n from public.payments where booking_id=$1',[b.id])).n,0);
 assert.equal((await asUser(reception,()=>one('select public.review_booking_request($1,true) id',[r.id]))).id,b.id);
});
test('customers cannot call administrative RPCs or create confirmed appointments directly',async()=>{
 const calls=[['select public.request_booking_services($1::uuid[],$2,$3,null)',[[s1],pro,`${day}T14:00:00+02:00`]], ["select public.register_payment($1,100,'cash',null)",[legacy]],['select public.validate_payment($1,true)',[legacy]],['select public.review_booking_request($1,true)',[legacy]],['select public.reschedule_booking($1,$2,$3)',[legacy,pro,`${day}T14:00:00+02:00`]], ["select public.set_booking_status($1,'in_progress')",[legacy]], ["select public.refund_payment($1,'QA')",[legacy]], ["select public.adjust_stock($1,1,'QA')",[legacy]]];
 for(const [sql,args]of calls)await assert.rejects(asUser(customer,()=>one(sql,args)));
});
test('anonymous RPC allowlist and financial data isolation',async()=>{
 const rows=(await db.query("select proname,has_function_privilege('anon',p.oid,'execute') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef")).rows;
 assert.deepEqual(rows.filter(x=>x.allowed).map(x=>x.proname).sort(),['public_booking_catalog','public_booking_slots','submit_booking_request']);
 await db.exec('set role anon');try{await assert.rejects(one('select public.review_booking_request($1,true)',[legacy]));await assert.rejects(one('select * from public.booking_requests'));await assert.rejects(one('select * from public.payments'));}finally{await db.exec('reset role');}
});
test('reception cannot refund or adjust stock; no direct payment writes',async()=>{
 await assert.rejects(asUser(reception,()=>one("select public.refund_payment($1,'QA')",[legacy])));
 await assert.rejects(asUser(reception,()=>one("select public.adjust_stock($1,1,'QA')",[legacy])));
 for(const u of [manager,reception,customer])await assert.rejects(asUser(u,()=>one("insert into public.payments(booking_id,amount_mzn,method) values($1,100,'cash')",[legacy])));
});
test('professional can update assigned appointments only and cannot handle payments',async()=>{
 const professional=(await one('insert into auth.users default values returning id')).id;
 await db.query("update public.profiles set role='professional' where id=$1",[professional]);
 await db.query('update public.professionals set profile_id=$1 where id=$2',[professional,pro]);
 const mine=await asUser(manager,()=>create([s1],'15:00'));const other=await asUser(manager,()=>create([s1],'15:00',pro2));
 await asUser(professional,()=>one("select public.set_booking_status($1,'in_progress')",[mine.id]));
 await assert.rejects(asUser(professional,()=>one("select public.set_booking_status($1,'in_progress')",[other.id])));
 await assert.rejects(asUser(professional,()=>one("select public.register_payment($1,100,'cash',null)",[mine.id])));
 await assert.rejects(asUser(professional,()=>one('select public.review_booking_request($1,true)',[mine.id])));
 await assert.rejects(asUser(professional,()=>one('select public.validate_payment($1,true)',[mine.id])));
 await assert.rejects(asUser(professional,()=>create([s1],'16:00')));
});
