export const services = [
  { id:'s1', name:'Corte feminino', category:'Cabelo', minutes:60, price:500 },
  { id:'s2', name:'Corte masculino', category:'Cabelo', minutes:30, price:250 },
  { id:'s4', name:'Alisamento', category:'Cabelo', minutes:150, price:3500 },
  { id:'s5', name:'Hidratação capilar', category:'Cabelo', minutes:45, price:800 },
  { id:'s3', name:'Tranças (box braids)', category:'Tranças', minutes:240, price:2500 },
  { id:'s6', name:'Manicure', category:'Unhas', minutes:45, price:400 },
  { id:'s7', name:'Pedicure', category:'Unhas', minutes:60, price:500 },
  { id:'s8', name:'Maquilhagem', category:'Rosto', minutes:60, price:1500 },
];
export const money = (n:number) => new Intl.NumberFormat('pt-PT').format(n)+' MT';
export const duration = (m:number) => [m>=60?`${Math.floor(m/60)} h`:'',m%60?`${m%60} min`:''].filter(Boolean).join(' ');
export function maputoNow() { const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Maputo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const get=(key:string)=>parts.find(p=>p.type===key)!.value;return {date:`${get('year')}-${get('month')}-${get('day')}`,minutes:Number(get('hour'))*60+Number(get('minute'))}; }
export const dateLabel = (key:string, options:Intl.DateTimeFormatOptions={day:'numeric',month:'long'})=>new Intl.DateTimeFormat('pt-PT',{...options,timeZone:'Africa/Maputo'}).format(new Date(key+'T12:00:00+02:00'));
export function openDays(today:string) { const days:string[]=[];const date=new Date(today+'T12:00:00Z');while(days.length<8){if(date.getUTCDay()!==0)days.push(date.toISOString().slice(0,10));date.setUTCDate(date.getUTCDate()+1);}return days; }
export function slotsFor(date:string, minutes:number, now=maputoNow()) {if(!date||!minutes||date<now.date||new Date(date+'T12:00:00Z').getUTCDay()===0)return [];const slots:string[]=[];for(let m=480;m+minutes<=1020;m+=30){if(date===now.date&&m<=now.minutes+30)continue;slots.push(`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`);}return slots;}
