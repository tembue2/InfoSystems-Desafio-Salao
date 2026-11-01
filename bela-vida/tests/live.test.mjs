import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { toLiveData, maputoDay } from '../lib/management/live-adapters.ts';
import { paid, price } from '../lib/management/model.ts';
import { loadWorkspace, allRows } from '../lib/management/services/workspace.ts';
import { executeAndReload } from '../lib/management/services/commit.ts';
import { perform } from '../lib/management/services/operations.ts';

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const userId=id(1), clientId=id(2), proId=id(3), serviceId=id(4), bookingId=id(5);
const starts='2026-11-02T06:00:00Z';
function database() {
 return {
  clients:[{id:clientId,full_name:'Cliente de teste',phone:null,email:null,profile_id:userId,created_at:starts}],
  services:[{id:serviceId,name:'Serviço de teste',description:null,price_mzn:900,duration_minutes:30,active:true}],
  professionals:[{id:proId,display_name:'Equipa de teste',profile_id:null,active:true}],
  professional_services:[{professional_id:proId,service_id:serviceId}],
  bookings:[{id:bookingId,client_id:clientId,customer_id:userId,service_id:serviceId,professional_id:proId,price_mzn:500,starts_at:starts,ends_at:'2026-11-02T07:00:00Z',status:'pending_payment',expires_at:'2099-01-01T00:00:00Z'}],
  booking_items:[{booking_id:bookingId,position:1,service_id:serviceId,service_name:'Serviço histórico',price_mzn:500,duration_minutes:60}],
  payments:[],expenses:[],manual_income:[],products:[],stock_movements:[],audit_events:[],
  work_hours:[{id:id(6),professional_id:proId,weekday:7,opens:'08:00:00',closes:'17:00:00'}],
  salon_settings:[{id:true,hold_minutes:60,policy_text:'Política de teste',policy_approved:false}],
  profiles:[{id:userId,full_name:'Conta de teste',role:'manager'}],
 };
}
function fixture(role='manager') {
 const db=database(), calls=[];db.profiles[0].role=role;
 let sequence=100;
 const error = message => new Response(JSON.stringify({code:'P0001',message}),{status:400,headers:{'Content-Type':'application/json'}});
 const client=createClient('https://controlled-test.supabase.co','sb_publishable_controlled_test',{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{headers:{Authorization:'Bearer controlled-test-token'},fetch:async (url,options)=>{
   const u=new URL(url),path=u.pathname,method=options.method??'GET',body=options.body?JSON.parse(options.body):null;
   calls.push({path,method,body});
   if(path==='/auth/v1/user')return Response.json({id:userId,aud:'authenticated',role:'authenticated',user_metadata:{role:'manager'},app_metadata:{},created_at:starts});
   if(path.includes('/rpc/')){
    const fn=path.split('/').at(-1);
    if(fn==='request_booking_services'){
     if(db.bookings.some(b=>b.professional_id===body.p_professional&&b.starts_at===body.p_starts_at&&b.status!=='cancelled'))return error('Horário indisponível');
     const b={...db.bookings[0],id:id(sequence++),client_id:body.p_client,professional_id:body.p_professional,service_id:body.p_services[0],starts_at:body.p_starts_at,ends_at:new Date(Date.parse(body.p_starts_at)+30*60000).toISOString()};db.bookings.push(b);db.booking_items.push({booking_id:b.id,position:1,service_id:b.service_id,service_name:'Serviço de teste',price_mzn:b.price_mzn,duration_minutes:30});return Response.json(b.id);
    }
    if(fn==='register_payment'){
     const b=db.bookings.find(b=>b.id===body.p_booking);if(b.status!=='pending_payment')return error('Reserva não pendente');
     const p={id:id(sequence++),booking_id:b.id,amount_mzn:body.p_amount,method:body.p_method,reference:body.p_reference??null,received_at:starts,validation_status:'pending',refunded_at:null,validated_at:null,registered_by:userId,validated_by:null};db.payments.push(p);return Response.json(p.id);
    }
    if(fn==='validate_payment'){
     const p=db.payments.find(p=>p.id===body.p_payment);if(p.validation_status!=='pending')return error('Já tratado');p.validation_status=body.p_approve?'validated':'rejected';p.validated_at=starts;
     const b=db.bookings.find(b=>b.id===p.booking_id);if(body.p_approve&&db.payments.filter(p=>p.booking_id===b.id&&p.validation_status==='validated').reduce((n,p)=>n+p.amount_mzn,0)===b.price_mzn)b.status='confirmed';return Response.json(null);
    }
    if(fn==='cancel_booking'){db.bookings.find(b=>b.id===body.p_booking).status='cancelled';return Response.json(null)}
    if(fn==='set_booking_status'){db.bookings.find(b=>b.id===body.p_booking).status=body.p_status;return Response.json(null)}
    if(fn==='refund_payment'){const p=db.payments.find(p=>p.id===body.p_payment);p.refunded_at=starts;return Response.json(null)}
    if(fn==='adjust_stock'){
     const p=db.products.find(p=>p.id===body.p_product);if(p.quantity+body.p_delta<0)return error('Stock insuficiente');p.quantity+=body.p_delta;db.stock_movements.push({id:id(sequence++),product_id:p.id,delta:body.p_delta,reason:body.p_reason,created_at:starts});return Response.json(p.quantity);
    }
    throw new Error('Unhandled RPC '+fn);
   }
   const table=path.split('/').at(-1);if(!(table in db))throw new Error('Unknown table '+table);
   let rows=db[table].filter(row=>{
    for(const [key,value] of u.searchParams){
     if(['select','order','limit','offset','on_conflict'].includes(key))continue;
     if(key==='booking_items.service_id') { if(!db.booking_items.some(i=>i.booking_id===row.id && i.service_id===value.slice(3))) return false; continue; }
     if(value.startsWith('eq.')&&String(row[key])!==value.slice(3))return false;
     if(value.startsWith('gt.')&&String(row[key])<=value.slice(3))return false;
     if(value.startsWith('gte.')&&String(row[key])<value.slice(4))return false;
     if(value.startsWith('in.')&&!value.slice(4,-1).split(',').includes(row[key]))return false;
    }return true;
   });
   if(method==='POST'){
    const values=Array.isArray(body)?body:[body];
    rows=values.map(value=>{const row={id:id(sequence++),quantity:0,created_at:starts,profile_id:null,email:null,phone:null,occurred_at:starts,...value};db[table].push(row);return row;});
   }else if(method==='PATCH'){for(const row of rows)Object.assign(row,body)}
   else if(method==='DELETE'){db[table]=db[table].filter(row=>!rows.includes(row));return Response.json(null)}
   const offset=Number(u.searchParams.get('offset')??0),limit=Number(u.searchParams.get('limit')??1000);rows=rows.slice(offset,offset+limit);
   const headers=new Headers(options.headers);return Response.json(headers.get('accept')?.includes('vnd.pgrst.object')?rows[0]??null:rows);
  }},
 });
 return {client,db,calls};
}

test('live projection retains historical price and duration, and uses Maputo dates', async()=>{
 const {client}=fixture();const data=await loadWorkspace(client);assert.equal(data.source,'supabase');assert.equal(price(data.appointments[0]),500);assert.equal(data.appointments[0].items[0].minutes,60);assert.equal(data.appointments[0].time,'08:00');assert.equal(data.services[0].price,900);assert.equal(data.professionals[0].schedule[0].open,true);
 assert.equal(maputoDay('2026-11-01T23:30:00Z'),'2026-11-02');assert.equal(data.settings.schedule.length,0);
});
test('expired holds are displayed as expired and missing relations fail closed', async()=>{
 const {client,db}=fixture();db.bookings[0].expires_at='2020-01-01T00:00:00Z';assert.equal((await loadWorkspace(client)).appointments[0].status,'expired');db.clients=[];await assert.rejects(loadWorkspace(client),e=>e.code==='unknown');
});
test('reception snapshot never queries manager tables or leaks financial rows',async()=>{
 const {client,calls}=fixture('reception');const data=await loadWorkspace(client);assert.deepEqual(data.products,[]);assert.deepEqual(data.expenses,[]);assert.equal(data.operationalSettings,null);
 for(const table of ['products','expenses','manual_income','work_hours','stock_movements','audit_events','salon_settings'])assert.equal(calls.some(c=>c.path.endsWith('/'+table)),false);
});
test('all API pages are read; a later failure does not produce partial totals',async()=>{
 let count=0;const result=await allRows((from,to)=>{count++;return Promise.resolve({data:Array.from({length:from===0?200:7},(_,i)=>from+i),error:null})});assert.equal(result.length,207);assert.equal(count,2);
 await assert.rejects(allRows(from=>Promise.resolve(from===0?{data:Array(200).fill(1),error:null}:{data:null,error:{code:'42501'}})),e=>e.code==='forbidden');
});
test('customer save persists across a fresh workspace load',async()=>{
 const {client}=fixture('reception');await perform(client,{type:'customer.save',name:'Nova cliente',phone:'840000000',email:'cliente@example.com'});const first=await loadWorkspace(client);const c=first.customers.find(c=>c.name==='Nova cliente');assert.ok(c);
 await perform(client,{type:'customer.save',id:c.id,name:'Nome actualizado',phone:'850000000',email:c.email});const second=await loadWorkspace(client);assert.equal(second.customers.find(x=>x.id===c.id).phone,'850000000');
});
test('register, validate and reload do not confirm a booking prematurely',async()=>{
 const {client,db}=fixture('reception');await perform(client,{type:'payment.register',bookingId,amount:500,method:'M-Pesa',reference:'TEST-001'});let data=await loadWorkspace(client);assert.equal(paid(data,bookingId),0);assert.equal(data.appointments[0].status,'pending');
 await perform(client,{type:'payment.validate',id:db.payments[0].id,approve:true});data=await loadWorkspace(client);assert.equal(paid(data,bookingId),500);assert.equal(data.appointments[0].status,'confirmed');
 await assert.rejects(perform(client,{type:'payment.validate',id:db.payments[0].id,approve:true}),e=>e.code==='conflict');
});
test('the application rejects a partial amount and stock changes by reception',async()=>{
 const {client,calls}=fixture('reception');await assert.rejects(perform(client,{type:'payment.register',bookingId,amount:250,method:'Numerário',reference:''}),e=>e.code==='validation');
 await assert.rejects(perform(client,{type:'stock.move',productId:id(10),delta:1,reason:'Teste'}),e=>e.code==='forbidden');assert.equal(calls.some(c=>c.path.endsWith('/rpc/register_payment')||c.path.endsWith('/rpc/adjust_stock')),false);
});
test('manager product balance changes only via stock RPC and cannot go negative',async()=>{
 const {client,db,calls}=fixture();await perform(client,{type:'product.save',name:'Material de teste',kind:'consumable',minimum:2,salePrice:null,active:true});const product=db.products[0];assert.equal(product.quantity,0);
 assert.equal('quantity' in calls.find(c=>c.path.endsWith('/products')&&c.method==='POST').body,false);
 await perform(client,{type:'stock.move',productId:product.id,delta:5,reason:'Entrada'});await perform(client,{type:'stock.move',productId:product.id,delta:-2,reason:'Consumo'});await assert.rejects(perform(client,{type:'stock.move',productId:product.id,delta:-10,reason:'Consumo'}));
 const data=await loadWorkspace(client);assert.equal(data.products[0].quantity,3);assert.equal(data.stockMovements.length,2);assert.equal(data.products[0].cost,undefined);assert.equal(data.stockMovements[0].before,undefined);
});
test('expenses, other income, policies and refunds persist without extra tables',async()=>{
 const {client,db}=fixture();await perform(client,{type:'expense.create',description:'Despesa teste',amount:100,occurredAt:starts});await perform(client,{type:'income.create',description:'Outra receita',amount:200,occurredAt:starts});await perform(client,{type:'settings.save',holdMinutes:90,policyText:'Política actualizada',policyApproved:true});
 await perform(client,{type:'payment.register',bookingId,amount:500,method:'Numerário',reference:''});const paymentId=db.payments[0].id;await perform(client,{type:'payment.validate',id:paymentId,approve:true});await perform(client,{type:'booking.cancel',id:bookingId});await perform(client,{type:'payment.refund',id:paymentId,reason:'Reembolso já efectuado'});
 const data=await loadWorkspace(client);assert.equal(data.expenses[0].amount,100);assert.equal(data.otherIncome[0].amount,200);assert.equal(data.operationalSettings.hold_minutes,90);assert.equal(data.payments[0].refundedAt,starts);assert.equal(paid(data,bookingId),0);
});
test('manager schedule and association guards reject invalidating future bookings',async()=>{
 const {client,db}=fixture();db.bookings[0].starts_at='2099-01-01T06:00:00Z';db.bookings[0].ends_at='2099-01-01T07:00:00Z';
 await assert.rejects(perform(client,{type:'professional.hours',professionalId:proId,weekday:1,open:false,opens:'',closes:''}),e=>e.code==='conflict');
 await assert.rejects(perform(client,{type:'professional.associate',professionalId:proId,serviceId,enabled:false}),e=>e.code==='conflict');
 await assert.rejects(perform(client,{type:'professional.save',id:proId,name:'Equipa',profileId:null,active:false}),e=>e.code==='conflict');
});
test('reception cannot call manager commands even with a forged role field',async()=>{
 const {client,calls}=fixture('reception');await assert.rejects(perform(client,{type:'settings.save',role:'manager',holdMinutes:60,policyText:'Teste',policyApproved:true}),e=>e.code==='forbidden');assert.equal(calls.some(c=>c.method==='PATCH'),false);
});

test('a committed write with a failed reload is never retried or reported as uncommitted',async()=>{
 const {client,db,calls}=fixture();const result=await executeAndReload(client,{type:'customer.save',name:'Guardada uma vez',phone:''},async()=>{throw new TypeError('network unavailable')});assert.equal(result.ok,true);assert.equal(result.data,null);assert.ok(result.refreshError);assert.equal(db.clients.filter(c=>c.full_name==='Guardada uma vez').length,1);assert.equal(calls.filter(c=>c.path.endsWith('/clients')&&c.method==='POST').length,1);
});

test('multi-service projection uses ordered historical items and rejects inconsistent totals', async()=>{
 const {client,db}=fixture();const second=id(11);
 db.services.push({...db.services[0],id:second,name:'Novo catálogo',price_mzn:1500});
 db.booking_items=[{booking_id:bookingId,position:2,service_id:second,service_name:'Serviço B histórico',price_mzn:200,duration_minutes:30},{booking_id:bookingId,position:1,service_id:serviceId,service_name:'Serviço A histórico',price_mzn:300,duration_minutes:30}];
 const data=await loadWorkspace(client);assert.deepEqual(data.appointments[0].items.map(i=>i.name),['Serviço A histórico','Serviço B histórico']);assert.equal(price(data.appointments[0]),500);
 db.booking_items[0].price_mzn=201;await assert.rejects(loadWorkspace(client),e=>e.code==='unknown');
});
