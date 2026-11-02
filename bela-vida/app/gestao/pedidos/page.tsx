import Link from 'next/link';
import {redirect} from 'next/navigation';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
import {requireAccess} from '@/lib/management/access';
import {managementError} from '@/lib/management/errors';
import {reviewRequest} from './actions';
import '../management.css';
import '../historico/history.css';
export const dynamic='force-dynamic';
export const metadata={title:'Pedidos de marcação — Bela Vida',robots:{index:false,follow:false}};
export default async function Requests({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const client=await createClient();try{await requireAccess(client);}catch(e){const err=managementError(e);if(['unauthenticated','forbidden'].includes(err.code))redirect('/gestao/entrar/');throw err;}
 const params=await searchParams;const page=Math.min(10000,Math.max(1,Math.floor(Number(params.page))||1));const state=['approved','rejected'].includes(params.state??'')?params.state!:'pending';
 const db=client as unknown as SupabaseClient;
 const [requests,services,professionals]=await Promise.all([db.from('booking_requests').select('*').eq('status',state).order('created_at',{ascending:false}).order('id').range((page-1)*50,page*50),client.from('services').select('id,name'),client.from('professionals').select('id,display_name')]);
 if(requests.error||services.error||professionals.error)throw new Error('Não foi possível carregar os pedidos. Tente novamente.');
 const rows=requests.data??[];const fmt=(s:string)=>new Date(s).toLocaleString('pt-PT',{timeZone:'Africa/Maputo'});
 return <div className="management history-shell"><Link className="mg-link" href="/gestao/">← Voltar à gestão</Link><h1>Pedidos de marcação</h1><p>Ao aprovar, o horário é reservado e a ficha da cliente é criada. A confirmação depende da validação do pagamento integral.</p><p className="mg-help">Os pedidos pendentes não bloqueiam horários. A disponibilidade é verificada novamente ao aprovar.</p><nav className="history-filters">{[['pending','Pendentes'],['approved','Aprovados'],['rejected','Recusados']].map(([key,label])=><Link className="mg-small-button" aria-current={state===key?'page':undefined} href={'?state='+key} key={key}>{label}</Link>)}<Link className="mg-small-button" href={'?state='+state}>Actualizar</Link></nav>{params.error&&<p role="alert">{params.error}</p>}{params.done&&<div role="status" style={{padding:16,marginBlock:16,borderRadius:12,background:"#e6f2e8",color:"#254c35"}}><strong>{params.done==='approved'?'Pedido aprovado. A marcação foi criada e aguarda pagamento.':params.done==='rejected'?'Pedido recusado.':'Pedido tratado com sucesso.'}</strong>{params.done==='approved'&&<p><Link className="mg-link" href="/gestao/">Abrir gestão para consultar a agenda e registar o pagamento →</Link></p>}</div>}
 <section className="history-list">{rows.slice(0,50).map(r=><article className="history-event" key={r.id}><h2>{r.full_name}</h2><p>{r.phone}</p><p><strong>{fmt(r.starts_at)}</strong> · {professionals.data?.find(p=>p.id===r.professional_id)?.display_name}</p><p>{(r.service_ids as string[]).map(id=>services.data?.find(s=>s.id===id)?.name??'Serviço indisponível').join(' + ')}</p>{r.notes&&<p style={{whiteSpace:'pre-wrap'}}>{r.notes}</p>}<p className="mg-help">Recebido em {fmt(r.created_at)} · {r.id}</p>{state==='pending'?<form action={reviewRequest} className="mg-form-actions"><input type="hidden" name="id" value={r.id}/><button className="mg-button" name="decision" value="approve">Aprovar pedido</button><button className="mg-button secondary" name="decision" value="reject">Recusar</button></form>:<p>{state==='approved'?'Aprovado — consulte a agenda para o pagamento.':'Pedido recusado.'}</p>}</article>)}{!rows.length&&<p>Sem pedidos nesta categoria.</p>}</section><nav className="history-pagination">{page>1&&<Link href={'?state='+state+'&page='+(page-1)}>Anterior</Link>}<span>Página {page}</span>{rows.length>50&&<Link href={'?state='+state+'&page='+(page+1)}>Seguinte</Link>}</nav></div>;
}

