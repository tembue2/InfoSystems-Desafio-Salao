export type Role = 'reception' | 'manager';
export type Status = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'expired';
export type Service = {id:string;name:string;category:string;price:number;minutes:number;active:boolean;description?:string};
export type Professional = {id:string;name:string;specialty:string;active:boolean;serviceIds:string[];schedule:WorkDay[];profileId?:string|null};
export type Customer = {id:string;name:string;phone:string;notes:string;email?:string};
export type LineItem = {serviceId:string;name:string;price:number;minutes:number};
export type Appointment = {id:string;customerId:string;professionalId:string;date:string;time:string;items:LineItem[];status:Status;notes:string;expiresAt?:string};
export type Payment = {id:string;appointmentId:string;amount:number;method:'M-Pesa'|'e-Mola'|'Numerário'|'POS'|'Transferência';reference:string;date:string;validationStatus?:'pending'|'validated'|'rejected';refundedAt?:string|null;receivedAt?:string;validatedAt?:string|null};
export type Expense = {id:string;description:string;category:string;amount:number;date:string};
export type Audit = {id:string;text:string;at:string;role?:Role;actorId?:string|null};
export type WorkDay={day:number;open:boolean;start:string;end:string;breakStart:string;breakEnd:string};
export const weekdays=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
export const defaultSchedule=():WorkDay[]=>weekdays.map((_,day)=>({day,open:day!==0,start:'08:00',end:'17:00',breakStart:'',breakEnd:''}));
export type SalonSettings={name:string;phone:string;address:string;schedule:WorkDay[]};
export type Product={id:string;name:string;category:'Produto'|'Material';unit:string;quantity:number;minimum:number;cost?:number;salePrice?:number|null;active:boolean};
export type StockMovement={id:string;productId:string;kind:'Entrada'|'Consumo'|'Ajuste';quantity:number;before?:number;after?:number;delta?:number;reason:string;at:string};
export type Data = {products:Product[];stockMovements:StockMovement[];settings:SalonSettings;services:Service[];professionals:Professional[];customers:Customer[];appointments:Appointment[];payments:Payment[];expenses:Expense[];audit:Audit[]};
export const labels:Record<Status,string>={pending:'Aguarda pagamento',confirmed:'Confirmada',in_progress:'Em atendimento',completed:'Concluída',cancelled:'Cancelada',no_show:'Não compareceu',expired:'Expirada'};
export const roleLabels:Record<Role,string>={reception:'Recepção',manager:'Gerente'};
export const methods:Payment['method'][]=['M-Pesa','e-Mola','Numerário','POS','Transferência'];
export const price=(a:Appointment)=>a.items.reduce((n,i)=>n+i.price,0);
export const minutes=(a:Appointment)=>a.items.reduce((n,i)=>n+i.minutes,0);
export const paid=(data:Data,id:string)=>data.payments.filter(p=>p.appointmentId===id&&(!p.validationStatus||p.validationStatus==='validated')&&!p.refundedAt).reduce((n,p)=>n+p.amount,0);
export const uid=()=>{const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`};
export const timeMinutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
export const endTime=(a:Appointment)=>{const n=timeMinutes(a.time)+minutes(a);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`};
export function todayKey(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Maputo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function moveDate(key:string,delta:number){const d=new Date(key+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10);}
export function nextOpenDay(key:string){return new Date(key+'T12:00:00Z').getUTCDay()===0?moveDate(key,1):key;}
export const dateText=(key:string)=>new Intl.DateTimeFormat('pt-PT',{day:'numeric',month:'long',timeZone:'Africa/Maputo'}).format(new Date(key+'T12:00:00Z'));
export function bookingError(data:Data,a:Appointment){
 if(!data.customers.some(c=>c.id===a.customerId))return 'Escolha uma cliente.';
 if(!data.professionals.some(p=>p.id===a.professionalId&&p.active))return 'Escolha uma profissional activa.';
 if(!a.items.length)return 'Escolha pelo menos um serviço.';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||Number.isNaN(Date.parse(a.date+'T12:00:00Z')))return 'Indique uma data válida.';
 if(a.date<todayKey())return 'A data não pode estar no passado.';

 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time))return 'Indique uma hora válida.';
 const start=timeMinutes(a.time),end=start+minutes(a);
 const availability=availabilityError(data,a);if(availability)return availability;
 if(data.appointments.some(b=>b.id!==a.id&&b.date===a.date&&b.professionalId===a.professionalId&&!['cancelled','no_show'].includes(b.status)&&start<timeMinutes(b.time)+minutes(b)&&end>timeMinutes(b.time)))return 'Esta profissional já tem uma marcação nesse intervalo. Escolha outra hora ou profissional.';
 return '';
}
export function scheduleError(rows:WorkDay[]){
 for(const r of rows.filter(r=>r.open)){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.end)||r.start>=r.end)return 'Indique uma abertura anterior ao fecho em '+weekdays[r.day]+'.';
 if((r.breakStart||r.breakEnd)&&(!r.breakStart||!r.breakEnd||r.breakStart<r.start||r.breakEnd>r.end||r.breakStart>=r.breakEnd))return 'A pausa deve estar dentro do horário em '+weekdays[r.day]+'.';
 }return '';
}
export function availabilityError(data:Data,a:Appointment){
 const professional=data.professionals.find(p=>p.id===a.professionalId);
 if(!professional?.active)return 'Escolha uma profissional activa.';
 if(a.items.some(i=>!professional.serviceIds.includes(i.serviceId)))return 'Esta profissional não realiza todos os serviços seleccionados.';
 const day=new Date(a.date+'T12:00:00Z').getUTCDay(),start=timeMinutes(a.time),end=start+minutes(a);
 for(const [schedule,label] of [[data.settings.schedule,'O salão'],[professional.schedule,'A profissional']] as const){
 const r=schedule.find(r=>r.day===day);
 if(!r?.open)return label+' não tem horário disponível neste dia.';
 if(start<timeMinutes(r.start)||end>timeMinutes(r.end))return label+' atende entre '+r.start+' e '+r.end+' neste dia.';
 if(r.breakStart&&r.breakEnd&&start<timeMinutes(r.breakEnd)&&end>timeMinutes(r.breakStart))return label+' tem uma pausa entre '+r.breakStart+' e '+r.breakEnd+'.';
 }return '';
}
export function affectedBooking(data:Data){return data.appointments.find(a=>a.date>=todayKey()&&['pending','confirmed','in_progress'].includes(a.status)&&availabilityError(data,a));}
export function calendarDays(date:string,mode:'week'|'month'){
 const d=new Date(date+'T12:00:00Z');
 if(mode==='week'){const start=moveDate(date,-((d.getUTCDay()+6)%7));return Array.from({length:7},(_,i)=>moveDate(start,i));}
 const first=date.slice(0,7)+'-01',offset=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7;
 const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 return Array.from({length:Math.ceil((offset+end)/7)*7},(_,i)=>moveDate(first,i-offset));
}
export function movePeriod(date:string,delta:number,mode:'day'|'week'|'month'){
 if(mode!=='month')return moveDate(date,delta*(mode==='week'?7:1));
 const d=new Date(date.slice(0,7)+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);return d.toISOString().slice(0,10);
}
export function seedData(date:string):Data{
 const services:Service[]=[{id:'s1',name:'Corte feminino',category:'Cabelo',minutes:60,price:500,active:true},{id:'s2',name:'Corte masculino',category:'Cabelo',minutes:30,price:250,active:true},{id:'s4',name:'Alisamento',category:'Cabelo',minutes:150,price:3500,active:true},{id:'s5',name:'Hidratação capilar',category:'Cabelo',minutes:45,price:800,active:true},{id:'s3',name:'Tranças (box braids)',category:'Tranças',minutes:240,price:2500,active:true},{id:'s6',name:'Manicure',category:'Unhas',minutes:45,price:400,active:true},{id:'s7',name:'Pedicure',category:'Unhas',minutes:60,price:500,active:true},{id:'s8',name:'Maquilhagem',category:'Rosto',minutes:60,price:1500,active:true}];
 const professionals:Professional[]=[{id:'p1',name:'Sofia',specialty:'Cabelo e tranças',active:true,serviceIds:['s1','s2','s3','s4','s5'],schedule:defaultSchedule()},{id:'p2',name:'Amélia',specialty:'Unhas e cuidados',active:true,serviceIds:['s6','s7'],schedule:defaultSchedule()},{id:'p3',name:'Carla',specialty:'Cabelo e maquilhagem',active:true,serviceIds:['s1','s2','s4','s5','s8'],schedule:defaultSchedule()}];
 const customers=[{id:'c1',name:'Ana Mucavele',phone:'',notes:''},{id:'c2',name:'Lúcia Matavele',phone:'',notes:'Prefere marcações de manhã.'},{id:'c3',name:'Mariana Cossa',phone:'',notes:''},{id:'c4',name:'Isabel Chissano',phone:'',notes:''},{id:'c5',name:'Beatriz Manjate',phone:'',notes:''},{id:'c6',name:'Cláudia Macamo',phone:'',notes:''}];
 const line=(id:string)=>{const s=services.find(s=>s.id===id)!;return {serviceId:s.id,name:s.name,price:s.price,minutes:s.minutes}};
 const appointments:Appointment[]=[{id:'BV-1001',customerId:'c1',professionalId:'p1',date,time:'08:00',items:[line('s1')],status:'completed',notes:''},{id:'BV-1002',customerId:'c2',professionalId:'p2',date,time:'08:30',items:[line('s6'),line('s7')],status:'in_progress',notes:''},{id:'BV-1003',customerId:'c3',professionalId:'p1',date,time:'09:30',items:[line('s3')],status:'confirmed',notes:''},{id:'BV-1004',customerId:'c4',professionalId:'p3',date,time:'10:00',items:[line('s8')],status:'pending',notes:'Pedido recebido por WhatsApp.'},{id:'BV-1005',customerId:'c5',professionalId:'p2',date,time:'11:00',items:[line('s6')],status:'pending',notes:''},{id:'BV-1006',customerId:'c6',professionalId:'p3',date,time:'13:00',items:[line('s5')],status:'confirmed',notes:''},{id:'BV-1007',customerId:'c1',professionalId:'p1',date:moveDate(date,1),time:'09:00',items:[line('s5')],status:'pending',notes:''}];
 const payments:Payment[]=[{id:'P-1001',appointmentId:'BV-1001',amount:500,method:'Numerário',reference:'',date},{id:'P-1002',appointmentId:'BV-1002',amount:900,method:'M-Pesa',reference:'DEMO-001',date},{id:'P-1003',appointmentId:'BV-1003',amount:2500,method:'e-Mola',reference:'DEMO-002',date},{id:'P-1004',appointmentId:'BV-1006',amount:800,method:'POS',reference:'DEMO-003',date}];
 return {settings:{name:'Salão Bela Vida',phone:'',address:'',schedule:defaultSchedule()},products:[{id:'prod1',name:'Champô hidratante',category:'Produto',unit:'frasco',quantity:8,minimum:3,cost:450,active:true},{id:'prod2',name:'Luvas descartáveis',category:'Material',unit:'par',quantity:12,minimum:20,cost:15,active:true},{id:'prod3',name:'Verniz nude',category:'Produto',unit:'frasco',quantity:0,minimum:2,cost:200,active:true}],stockMovements:[],services,professionals,customers,appointments,payments,expenses:[{id:'e1',description:'Produtos de higiene',category:'Consumíveis',amount:650,date},{id:'e2',description:'Transporte de materiais',category:'Transporte',amount:200,date}],audit:[{id:'a1',text:'Dados de demonstração carregados.',at:new Date().toISOString(),role:'manager'}]};
}
