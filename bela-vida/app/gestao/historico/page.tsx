import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireAccess} from '@/lib/management/access';
import {managementError} from '@/lib/management/errors';
import '../management.css';
import './history.css';
export const dynamic='force-dynamic';
export const metadata={title:'Histórico de actividades — Bela Vida',robots:{index:false,follow:false}};
const entities:Record<string,string>={bookings:'Marcações',payments:'Pagamentos',expenses:'Despesas',manual_income:'Outras receitas',stock_movements:'Movimentos de stock',services:'Serviços',professionals:'Profissionais',work_hours:'Horários',time_off:'Ausências',salon_settings:'Definições',clients:'Clientes',professional_services:'Serviços dos profissionais'};
const actions:Record<string,string>={INSERT:'Criação',UPDATE:'Alteração',DELETE:'Eliminação'};
const fields:Record<string,string>={status:'Estado',starts_at:'Início',ends_at:'Fim',professional_id:'Profissional',price_mzn:'Preço (MT)',amount_mzn:'Valor (MT)',validation_status:'Validação',refunded_at:'Reembolso',method:'Método',active:'Activo',name:'Nome',display_name:'Nome',full_name:'Nome',description:'Descrição',quantity:'Quantidade',delta:'Variação de stock',reason:'Motivo',duration_minutes:'Duração (minutos)',opens:'Abertura',closes:'Fecho',weekday:'Dia da semana',hold_minutes:'Prazo de reserva',policy_approved:'Política aprovada',policy_text:'Política',min_quantity:'Quantidade mínima',sale_price_mzn:'Preço de venda (MT)'};
const values:Record<string,string>={pending_payment:'A aguardar pagamento',confirmed:'Confirmada',in_progress:'Em atendimento',completed:'Concluída',cancelled:'Cancelada',expired:'Expirada',pending:'Pendente',validated:'Validado',rejected:'Rejeitado',cash:'Numerário',mpesa:'M-Pesa',emola:'e-Mola',bank_transfer:'Transferência'};
const stamp=(s:string)=>new Date(s).toLocaleString('pt-PT',{timeZone:'Africa/Maputo'});
function object(v:unknown):Record<string,unknown>{return v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};}
function show(v:unknown,key:string){if(v==null)return '—';if(typeof v==='boolean')return v?'Sim':'Não';if(typeof v==='string'&&['starts_at','ends_at','refunded_at'].includes(key)&&Number.isFinite(Date.parse(v)))return stamp(v);const s=typeof v==='object'?JSON.stringify(v):String(v);return values[s]??s;}
function day(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
export default async function History({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const client=await createClient();
 let role: 'manager'|'reception';
 try{role=(await requireAccess(client)).role;}catch(e){const err=managementError(e);if(err.code==='unauthenticated')redirect('/gestao/entrar/');if(err.code==='forbidden')redirect('/gestao/');throw err;}
 const params=await searchParams;const read=(key:string)=>typeof params[key]==='string'?params[key] as string:'';
 const availableEntities=role==='manager'?entities:{bookings:entities.bookings,payments:entities.payments};
 const entity=Object.hasOwn(availableEntities,read('entity'))?read('entity'):'';const action=Object.hasOwn(actions,read('action'))?read('action'):'';
 const from=day(read('from'))?read('from'):'';const to=day(read('to'))?read('to'):'';
 const actor=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(read('actor'))?read('actor'):'';
 const page=Math.min(10000,Math.max(1,Math.floor(Number(read('page')))||1));const invalid=!!(from&&to&&from>to);
 let query=client.from('audit_events').select('id,entity,record_id,action,actor_id,created_at,details').order('id',{ascending:false});
 if(role==='reception')query=query.in('entity',['bookings','payments']);
 if(entity)query=query.eq('entity',entity);if(action)query=query.eq('action',action);if(actor)query=query.eq('actor_id',actor);
 if(from)query=query.gte('created_at',from+'T00:00:00+02:00');if(to)query=query.lt('created_at',new Date(Date.parse(to+'T00:00:00+02:00')+86400000).toISOString());
 const result=invalid?{data:[],error:null}:await query.range((page-1)*50,page*50);if(result.error)throw managementError(result.error);
 const rows=result.data??[];const more=rows.length>50;const events=rows.slice(0,50);
 const ids=[...new Set(events.map(e=>e.actor_id).filter((id):id is string=>!!id))];const names=new Map<string,string>();
 if(ids.length){const profiles=await client.from('profiles').select('id,full_name').in('id',ids);if(profiles.error)throw managementError(profiles.error);profiles.data?.forEach(p=>names.set(p.id,p.full_name));}
 const url=(n:number)=>{const q=new URLSearchParams();for(const [k,v] of Object.entries({entity,action,from,to,actor,page:String(n)}))if(v)q.set(k,v);return '/gestao/historico/?'+q.toString();};
 return <div className="management history-shell"><header className="mg-page-heading"><div><Link href="/gestao/" className="mg-link">← Voltar à gestão</Link><h1>Histórico de actividades</h1><p>Operações registadas no sistema · Horário de Maputo · Agenda e operações do salão</p></div><Link className="mg-small-button" href={url(1)}>Actualizar</Link></header>
 <form className="history-filters" action="/gestao/historico/"><label>Área<select name="entity" defaultValue={entity}><option value="">Todas as áreas</option>{Object.entries(availableEntities).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Operação<select name="action" defaultValue={action}><option value="">Todas as operações</option>{Object.entries(actions).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Desde<input type="date" name="from" defaultValue={from}/></label><label>Até<input type="date" name="to" defaultValue={to}/></label>{actor&&<input type="hidden" name="actor" value={actor}/>}<button className="mg-button">Filtrar</button><Link className="mg-link" href="/gestao/historico/">Limpar filtros</Link></form>
 {actor&&<p className="mg-help">A mostrar apenas as operações do utilizador seleccionado.</p>}{invalid&&<p role="alert">A data inicial deve ser anterior ou igual à data final.</p>}
 <p className="mg-help">O histórico apresenta os eventos efectivamente guardados. As operações anteriores à activação de cada registo podem não estar disponíveis.</p>
 <section aria-label="Actividades" className="history-list">{events.map(e=>{const detail=object(e.details),before=object(detail.before),after=object(detail.after);const changed=Object.keys(fields).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));const rescheduled=e.entity==='bookings'&&e.action==='UPDATE'&&['starts_at','professional_id'].some(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));return <article key={e.id} className="history-event"><div className="history-event-head"><div><strong>{entities[e.entity]??e.entity} · {rescheduled?'Reagendamento':actions[e.action]??e.action}</strong><p>{e.actor_id?<Link href={'/gestao/historico/?actor='+encodeURIComponent(e.actor_id)}>{names.get(e.actor_id)||'Utilizador '+e.actor_id}</Link>:'Sistema / operação sem utilizador associado'}</p></div><time dateTime={e.created_at}>{stamp(e.created_at)}</time></div><details><summary>Ver alterações</summary><p className="history-id">Registo: {e.record_id??'Sem identificador'} · Evento: {e.id}</p>{changed.length?<div className="mg-table-scroll"><table className="mg-table"><thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>{changed.map(k=><tr key={k}><th>{fields[k]}</th><td>{show(before[k],k)}</td><td>{show(after[k],k)}</td></tr>)}</tbody></table></div>:<p>Operação registada sem alterações nos campos apresentados.</p>}</details></article>})}{!events.length&&!invalid&&<div className="history-event">Sem actividades para estes filtros.</div>}</section>
 <nav className="history-pagination" aria-label="Páginas do histórico">{page>1&&<Link className="mg-small-button" href={url(page-1)}>Anterior</Link>}<span>Página {page} · {events.length} registos</span>{more&&<Link className="mg-small-button" href={url(page+1)}>Seguinte</Link>}</nav></div>;
}
